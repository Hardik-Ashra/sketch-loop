'use client'
import { addArrow, addEllipse, addFrame, addFreeDrawShape, addGeneratedUI, addLine, addRect, addText, clearSelection, FrameShape, removeShape, selectShape, setTool, Shape, Tool, updateShape } from "@/redux/slices/shapes";
import { handToolDisable, handToolEnable, panEnd, panMove, panStart, Point, screenToWorld, wheelPan, wheelZoom } from "@/redux/slices/viewport";
import { AppDispatch, useAppDispatch, useAppSelector } from "@/redux/store";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux"
import { downloadBlob, exportGeneratedUIAsPNG, generateFrameSnapshot } from "@/lib/frame-snapshot";
import { nanoid } from "@reduxjs/toolkit";
import { toast } from "sonner";
import { useGenerateWorkflowMutation } from "@/redux/api/generation";
import { addErrorMessage, addUserMessage, clearChat, finishStreamingResponse, initializeChat, startStreamingResponse, updateStreamingContent } from "@/redux/slices/chat";

interface TouchPointer {
    id: number,
    p: Point
}
interface DraftShape {
    type: 'frame' | 'rect' | 'ellipse' | 'arrow' | 'line'
    startWorld: Point
    currentWorld: Point
}
const RAF_INTERVAL_MS = 8
export const useInfiniteCanvas = () => {
    const dispatch = useDispatch<AppDispatch>();

    const viewport = useAppSelector((s) => s.viewport)


    const entityState = useAppSelector((s) => s.shapes.shapes)
    const shapeList = useMemo(() => {
        return entityState.ids
            .map((id: string) => entityState.entities[id])
            .filter((s: Shape | undefined): s is Shape => Boolean(s))
    }, [entityState])
    const currentTool = useAppSelector((s) => s.shapes.tool)

    const selectedShapes = useAppSelector((s) => s.shapes.selected)

    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const shapesEntities = useAppSelector((state) => state.shapes.shapes.entities)

    const hasSelectedText = Object.keys(selectedShapes).some((id) => {
        const shape = shapesEntities[id]
        return shape?.type === 'text'
    })

    useEffect(() => {
        if (hasSelectedText && !isSidebarOpen) {
            setIsSidebarOpen(true)
        }
        else if (!hasSelectedText) {
            setIsSidebarOpen(false)
        }
    }, [hasSelectedText, isSidebarOpen])

    const canvasRef = useRef<HTMLDivElement | null>(null)
    const touchMapRef = useRef<Map<number, TouchPointer>>(new Map());

    const draftShapeRef = useRef<DraftShape | null>(null);
    const freeDrawPointsRef = useRef<Point[]>([]);
    const isSpacePressed = useRef(false);
    const isDrawingRef = useRef(false);
    const isMovingRef = useRef(false);
    const moveStartRef = useRef<Point | null>(null);

    const initialShapePositionRef = useRef<
        Record<
            string,
            {
                x?: number,
                y?: number,
                points?: Point[]
                startX?: number
                startY?: number
                endX?: number
                endY?: number
            }
        >
    >(
        {}
    )

    const isErasingRef = useRef(false)
    const erasedShapesRef = useRef<Set<string>>(new Set())
    const isResizingRef = useRef(false)
    const resizeDataRef = useRef<{
        shapeId: string
        corner: string
        initialBounds: { x: number; y: number; w: number; h: number }
        startPoint: { x: number; y: number }
    } | null>(null)

    const lastFreehandFrameRef = useRef(0)
    const freehandRafRef = useRef<number | null>(null)
    const panRafRef = useRef<number | null>(null)
    const pendingPanPointRef = useRef<Point | null>(null)

    const [, force] = useState(0)
    const requestRender = (): void => {
        force((n) => (n + 1) | 0)
    }

    const localPointFromClient = (clientX: number, clientY: number): Point => {
        const el = canvasRef.current
        if (!el) return { x: clientX, y: clientY }
        const r = el.getBoundingClientRect()
        return { x: clientX - r.left, y: clientY - r.top }
    }

    const blurActiveTextInput = () => {
        const activeElement = document.activeElement
        if (activeElement && activeElement.tagName === 'INPUT') {
            ; (activeElement as HTMLInputElement).blur()
        }
    }

    type WithClientXY = { clientX: number; clientY: number }
    const getLocalPointFromPtr = (e: WithClientXY): Point =>
        localPointFromClient(e.clientX, e.clientY)

    const getShapeAtPoint = (worldPoint: Point): Shape | null => {
        for (let i = shapeList.length - 1; i >= 0; i--) {
            const shape = shapeList[i]
            if (isPointInShape(worldPoint, shape)) {
                return shape
            }
        }
        return null
    }


    const isPointInShape = (point: Point, shape: Shape): boolean => {
        switch (shape.type) {
            case 'frame':
            case 'rect':
            case 'ellipse':
            case 'generatedui':
                return (
                    point.x >= shape.x &&
                    point.x <= shape.x + shape.w &&
                    point.y >= shape.y &&
                    point.y <= shape.y + shape.h
                )

            case 'freedraw':
                const threshold = 5
                for (let i = 0; i < shape.points.length - 1; i++) {
                    const p1 = shape.points[i]
                    const p2 = shape.points[i + 1]
                    if (distanceToLineSegment(point, p1, p2) <= threshold) {
                        return true
                    }
                }
                return false
            case 'arrow':
            case 'line':
                const lineThreshold = 8
                return (
                    distanceToLineSegment(
                        point,
                        { x: shape.startX, y: shape.startY },
                        { x: shape.endX, y: shape.endY }
                    ) <= lineThreshold
                )
            case 'text':
                const textWidth = Math.max(
                    shape.text.length * (shape.fontSize * 0.6),
                    100
                )
                const textHeight = shape.fontSize * 1.2
                const padding = 8
                return (
                    point.x >= shape.x - 2 &&
                    point.x <= shape.x + textWidth + padding + 2 &&
                    point.y >= shape.y - 2 &&
                    point.y <= shape.y + textHeight + padding + 2
                )
            default:
                return false
        }
    }

    const distanceToLineSegment = (
        point: Point,
        lineStart: Point,
        lineEnd: Point
    ): number => {
        const A = point.x - lineStart.x
        const B = point.y - lineStart.y
        const C = lineEnd.x - lineStart.x
        const D = lineEnd.y - lineStart.y

        const dot = A * C + B * D
        const lenSq = C * C + D * D
        let param = -1
        if (lenSq !== 0) param = dot / lenSq
        let xx, yy
        if (param < 0) {
            xx = lineStart.x
            yy = lineStart.y
        } else if (param > 1) {
            xx = lineEnd.x
            yy = lineEnd.y
        } else {
            xx = lineStart.x + param * C
            yy = lineStart.y + param * D
        }
        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    const schedulePanMove = (p: Point) => {
        pendingPanPointRef.current = p
        if (panRafRef.current != null) return
        panRafRef.current = window.requestAnimationFrame(() => {
            panRafRef.current = null
            const next = pendingPanPointRef.current
            if (next) dispatch(panMove(next))
        })
    }

    const freehandTick = (): void => {
        const now = performance.now()
        if (now - lastFreehandFrameRef.current >= RAF_INTERVAL_MS) {
            if (freeDrawPointsRef.current.length > 0) requestRender()
            lastFreehandFrameRef.current = now
        }
        if (isDrawingRef.current) {
            freehandRafRef.current = window.requestAnimationFrame(freehandTick)
        }
    }

    const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        const originScreen = localPointFromClient(e.clientX, e.clientY)
        if (e.ctrlKey || e.metaKey) {
            dispatch(wheelZoom({ deltaY: e.deltaY, originScreen }))
        } else {
            const dx = e.shiftKey ? e.deltaY : e.deltaX
            const dy = e.shiftKey ? 0 : e.deltaY
            dispatch(wheelPan({ dx: -dx, dy: -dy }))
        }
    }

    const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
        const target = e.target as HTMLElement
        const isButton =
            target.tagName === 'BUTTON' ||
            target.closest('button') ||
            target.classList.contains('pointer-events-auto') ||
            target.closest('.pointer-events-auto')
        if (!isButton) {
            e.preventDefault()
        } else {
            console.log(
                'Not preventing default - clicked on interactive element:',
                target
            )
            return // Don't handle canvas interactions when clicking buttons
        }


        const local = getLocalPointFromPtr(e.nativeEvent)
        const world = screenToWorld(local, viewport.translate, viewport.scale)
        if (touchMapRef.current.size <= 1) {
            canvasRef.current?.setPointerCapture?.(e.pointerId)
            const isPanButton = e.button === 1 || e.button === 2
            const panByShift = isSpacePressed.current && e.button == 0
            if (isPanButton || panByShift) {
                const mode = isSpacePressed.current ? 'shiftPanning' : 'panning'
                dispatch(panStart({ screen: local, mode }))
                return
            }
            if (e.button === 0) {
                if (currentTool === 'select') {
                    const hitShape = getShapeAtPoint(world)
                    if (hitShape) {
                        const isAlreadySelected = selectedShapes[hitShape.id]
                        if (!isAlreadySelected) {
                            if (!e.shiftKey) dispatch(clearSelection())
                            dispatch(selectShape(hitShape.id))
                        }
                        isMovingRef.current = true
                        moveStartRef.current = world
                        initialShapePositionRef.current = {}
                        const selectionIds = e.shiftKey
                            ? { ...selectedShapes, [hitShape.id]: true }
                            : { [hitShape.id]: true }

                        Object.keys(selectionIds).forEach((id) => {
                            const shape = entityState.entities[id]
                            if (shape) {
                                if (
                                    shape.type === 'frame' ||
                                    shape.type === 'rect' ||
                                    shape.type === 'ellipse' ||
                                    shape.type === 'generatedui'
                                ) {
                                    initialShapePositionRef.current[id] = {
                                        x: shape.x,
                                        y: shape.y,
                                    }
                                } else if (shape.type === 'freedraw') {
                                    initialShapePositionRef.current[id] = {
                                        points: [...shape.points],
                                    }
                                } else if (shape.type === 'arrow' || shape.type === 'line') {
                                    initialShapePositionRef.current[id] = {
                                        startX: shape.startX,
                                        startY: shape.startY,
                                        endX: shape.endX,
                                        endY: shape.endY,
                                    }
                                } else if (shape.type === 'text') {
                                    initialShapePositionRef.current[id] = {
                                        x: shape.x,
                                        y: shape.y,
                                    }
                                }
                            }
                        })

                        if (
                            hitShape.type === 'frame' ||
                            hitShape.type === 'rect' ||
                            hitShape.type === 'ellipse' ||
                            hitShape.type === 'generatedui'
                        ) {
                            initialShapePositionRef.current[hitShape.id] = {
                                x: hitShape.x,
                                y: hitShape.y,
                            }
                        } else if (hitShape.type === 'freedraw') {
                            initialShapePositionRef.current[hitShape.id] = {
                                points: [...hitShape.points],
                            }
                        }
                        else if (hitShape.type === 'arrow' || hitShape.type === 'line') {
                            initialShapePositionRef.current[hitShape.id] = {
                                startX: hitShape.startX,
                                startY: hitShape.startY,
                                endX: hitShape.endX,
                                endY: hitShape.endY,
                            }
                        }
                        else if (hitShape.type === 'text') {
                            initialShapePositionRef.current[hitShape.id] = {
                                x: hitShape.x,
                                y: hitShape.y,
                            }
                        }
                    }
                    else {
                        if (!e.shiftKey) {
                            dispatch(clearSelection())
                            blurActiveTextInput()
                        }
                    }
                }
                else if (currentTool === "eraser") {
                    isErasingRef.current = true
                    erasedShapesRef.current.clear()
                    const hitShape = getShapeAtPoint(world)
                    if (hitShape) {
                        dispatch(removeShape(hitShape.id))
                        erasedShapesRef.current.add(hitShape.id)
                    } else {
                        blurActiveTextInput()
                    }
                } else if (currentTool === 'text') {
                    dispatch(addText({ x: world.x, y: world.y }))
                    dispatch(setTool('select'))
                } else {
                    isDrawingRef.current = true

                    if (currentTool === "freedraw") {
                        freeDrawPointsRef.current = [world]
                        lastFreehandFrameRef.current = performance.now()
                        if (!freehandRafRef.current) {
                            freehandRafRef.current = requestAnimationFrame(freehandTick)
                        }
                    }
                    if (
                        currentTool === 'frame' ||
                        currentTool === 'rect' ||
                        currentTool === 'ellipse' ||
                        currentTool === 'arrow' ||
                        currentTool === 'line'
                    ) {
                        console.log('Starting to draw:', currentTool, 'at:', world)
                        draftShapeRef.current = {
                            type: currentTool,
                            startWorld: world,
                            currentWorld: world,
                        }
                        requestRender()
                    }
                }

            }
        }
    }

    const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
        const local = getLocalPointFromPtr(e.nativeEvent)
        const world = screenToWorld(local, viewport.translate, viewport.scale)
        if (viewport.mode === 'panning' || viewport.mode === 'shiftPanning') {
            schedulePanMove(local)
            return
        }
        if (isErasingRef.current && currentTool === 'eraser') {
            const hitShape = getShapeAtPoint(world)
            if (hitShape && !erasedShapesRef.current.has(hitShape.id)) {
                // Delete the shape if we haven't already deleted it in this drag
                dispatch(removeShape(hitShape.id))
                erasedShapesRef.current.add(hitShape.id)
            }
        }
        if (
            isMovingRef.current
            && moveStartRef.current
            && currentTool === 'select'
        ) {
            const deltaX = world.x - moveStartRef.current.x
            const deltaY = world.y - moveStartRef.current.y
            Object.keys(initialShapePositionRef.current).forEach((id) => {

                const initialPos = initialShapePositionRef.current[id]
                const shape = entityState.entities[id]

                if (shape && initialPos) {
                    if (
                        shape.type === 'frame' ||
                        shape.type === 'rect' ||
                        shape.type === 'ellipse' ||
                        shape.type === 'text' ||
                        shape.type === 'generatedui'
                    ) {
                        if (
                            typeof initialPos.x === 'number' && typeof initialPos.y === 'number'
                        ) {
                            dispatch(
                                updateShape({
                                    id: id,
                                    patch: {
                                        x: initialPos.x + deltaX,
                                        y: initialPos.y + deltaY,
                                    }
                                })
                            )
                        }
                    }
                    else if (shape.type === 'freedraw') {
                        const initialPoints = initialPos.points
                        if (initialPoints) {
                            const newPoints = initialPoints.map((p) => {
                                return {
                                    x: p.x + deltaX,
                                    y: p.y + deltaY,
                                }
                            })
                            dispatch(
                                updateShape({
                                    id: id,
                                    patch: {
                                        points: newPoints,
                                    }
                                })
                            )
                        }
                    }
                    else if (shape.type === 'arrow' || shape.type === 'line') {

                        if (
                            typeof initialPos.startX === 'number' &&
                            typeof initialPos.startY === 'number' &&
                            typeof initialPos.endX === 'number' &&
                            typeof initialPos.endY === 'number'
                        ) {
                            dispatch(
                                updateShape({
                                    id: id,
                                    patch: {
                                        startX: initialPos.startX + deltaX,
                                        startY: initialPos.startY + deltaY,
                                        endX: initialPos.endX + deltaX,
                                        endY: initialPos.endY + deltaY,
                                    }
                                })
                            )
                        }

                    }
                }
            })
        }
        if (isDrawingRef.current) {
            if (draftShapeRef.current) {
                draftShapeRef.current.currentWorld = world
                requestRender()
            }
            else if (currentTool === 'freedraw') {
                const pts = freeDrawPointsRef.current
                const last = pts[pts.length - 1]

                if (!last || Math.hypot(world.x - last.x, world.y - last.y) > 1.5) {
                    pts.push(world)
                }
            }
        }

    }

    const finalizeDrawingIfAny = (): void => {
        if (!isDrawingRef.current) return
        isDrawingRef.current = false

        if (freehandRafRef.current) {
            window.cancelAnimationFrame(freehandRafRef.current)
            freehandRafRef.current = null
        }
        const draft = draftShapeRef.current
        if (draft) {
            const x = Math.min(draft.startWorld.x, draft.currentWorld.x)
            const y = Math.min(draft.startWorld.y, draft.currentWorld.y)
            const w = Math.abs(draft.startWorld.x - draft.currentWorld.x)
            const h = Math.abs(draft.startWorld.y - draft.currentWorld.y)
            if (w > 1 && h > 1) {
                if (draft.type === 'frame') {
                    console.log('Adding frame shape')
                    dispatch(addFrame({ x, y, w, h }))
                }
                else if (draft.type === 'rect') {
                    dispatch(addRect({ x, y, w, h }))
                }
                else if (draft.type === 'ellipse') {
                    dispatch(addEllipse({ x, y, w, h }))
                }
                else if (draft.type === 'arrow') {
                    dispatch(addArrow({
                        startX: draft.startWorld.x,
                        startY: draft.startWorld.y,
                        endX: draft.currentWorld.x,
                        endY: draft.currentWorld.y
                    }))
                }
                else if (draft.type === 'line') {
                    dispatch(addLine({
                        startX: draft.startWorld.x,
                        startY: draft.startWorld.y,
                        endX: draft.currentWorld.x,
                        endY: draft.currentWorld.y
                    }))
                }
            }
            draftShapeRef.current = null
        }
        else if (currentTool === 'freedraw') {
            const pts = freeDrawPointsRef.current
            if (pts.length > 1) dispatch(addFreeDrawShape({ points: pts }))
            freeDrawPointsRef.current = []
        }
        requestRender()
    }
    const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
        canvasRef.current?.releasePointerCapture?.(e.pointerId)
        if (viewport.mode === 'panning' || viewport.mode === 'shiftPanning') {
            dispatch(panEnd())
        }
        if (isMovingRef.current) {
            isMovingRef.current = false
            moveStartRef.current = null
            initialShapePositionRef.current = {}
        }
        if (isErasingRef.current) {
            isErasingRef.current = false
            erasedShapesRef.current.clear()
        }
        finalizeDrawingIfAny()
    }

    const onPointerCancel: React.PointerEventHandler<HTMLDivElement> = (e) => {
        onPointerUp(e)
    }

    const onKeyDown = (e: KeyboardEvent): void => {
        if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
            e.preventDefault()
            isSpacePressed.current = true // Keep the same ref name for consistency
            dispatch(handToolEnable())
        }
    }
    const onKeyUp = (e: KeyboardEvent): void => {
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
            e.preventDefault()
            isSpacePressed.current = false
            dispatch(handToolDisable())
        }
    }

    useEffect(() => {
        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('keyup', onKeyUp)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            document.removeEventListener('keyup', onKeyUp)
            if (freehandRafRef.current)
                window.cancelAnimationFrame(freehandRafRef.current)
            if (panRafRef.current) window.cancelAnimationFrame(panRafRef.current)
        }
    }, [])

    useEffect(() => {
        const handleResizeStart = (e: CustomEvent) => {
            const { shapeId, corner, bounds, clientX, clientY } = e.detail

            isResizingRef.current = true
            resizeDataRef.current = {
                shapeId,
                corner,
                initialBounds: bounds,
                startPoint: { x: clientX, y: clientY },
            }
        }

        const handleResizeMove = (e: CustomEvent) => {
            if (!isResizingRef.current || !resizeDataRef.current) return

            const { shapeId, corner, initialBounds } = resizeDataRef.current
            const { clientX, clientY } = e.detail

            const canvasEl = canvasRef.current
            if (!canvasEl) return

            const rect = canvasEl.getBoundingClientRect()

            const localX = clientX - rect.left
            const localY = clientY - rect.top

            const world = screenToWorld(
                { x: localX, y: localY },
                viewport.translate,
                viewport.scale
            )

            const shape = entityState.entities[shapeId]
            if (!shape) return

            const newBounds = { ...initialBounds }

            switch (corner) {
                case 'nw':
                    newBounds.w = Math.max(10, initialBounds.w + (initialBounds.x - world.x))
                    newBounds.h = Math.max(10, initialBounds.h + (initialBounds.y - world.y))
                    newBounds.x = world.x
                    newBounds.y = world.y
                    break
                case 'ne':
                    newBounds.w = Math.max(10, world.x - initialBounds.x)
                    newBounds.h = Math.max(10, initialBounds.h + (initialBounds.y - world.y))
                    newBounds.y = world.y
                    break
                case 'sw':
                    newBounds.w = Math.max(10, initialBounds.w + (initialBounds.x - world.x))
                    newBounds.h = Math.max(10, world.y - initialBounds.y)
                    newBounds.x = world.x
                    break
                case 'se':
                    newBounds.w = Math.max(10, world.x - initialBounds.x)
                    newBounds.h = Math.max(10, world.y - initialBounds.y)
                    break
            }

            if (
                shape.type === 'frame' ||
                shape.type === 'rect' ||
                shape.type === 'ellipse'
            ) {
                dispatch(
                    updateShape({
                        id: shapeId,
                        patch: {
                            x: newBounds.x,
                            y: newBounds.y,
                            w: newBounds.w,
                            h: newBounds.h,
                        },
                    })
                )
            }
        }

        const handleResizeEnd = () => {
            isResizingRef.current = false
            resizeDataRef.current = null
        }

        // ✅ LISTENERS GO HERE (NOT INSIDE HANDLER)
        window.addEventListener('shape-resize-start', handleResizeStart as EventListener)
        window.addEventListener('shape-resize-move', handleResizeMove as EventListener)
        window.addEventListener('shape-resize-end', handleResizeEnd as EventListener)

        return () => {
            window.removeEventListener('shape-resize-start', handleResizeStart as EventListener)
            window.removeEventListener('shape-resize-move', handleResizeMove as EventListener)
            window.removeEventListener('shape-resize-end', handleResizeEnd as EventListener)
        }
    }, [dispatch, entityState.entities, viewport.translate, viewport.scale])


    const attachCanvasRef = (ref: HTMLDivElement | null): void => {
        if (canvasRef.current) {
            canvasRef.current.removeEventListener('wheel', onWheel)
        }

        canvasRef.current = ref;

        if (ref) {
            ref.addEventListener('wheel', onWheel, { passive: false })
        }
    }
    const selectTool = (tool: Tool): void => {
        dispatch(setTool(tool))
    }

    const getDraftShape = (): DraftShape | null => draftShapeRef.current
    const getFreeDraftPoints = (): ReadonlyArray<Point> => freeDrawPointsRef.current


    return {
        viewport,
        shapes: shapeList,
        currentTool,
        selectedShapes,

        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,

        attachCanvasRef,
        selectTool,
        getDraftShape,
        getFreeDraftPoints,
        isSidebarOpen,
        hasSelectedText,
        setIsSidebarOpen
    }
}

export const useFrame = (shape: FrameShape) => {
    const dispatch = useAppDispatch()
    const [isGenerating, setIsGenerating] = useState(false)

    const allShapes = useAppSelector((state) =>
        Object.values(state.shapes.shapes?.entities || {}).filter(
            (shape): shape is Shape => shape !== undefined
        )
    )

    const handleGenerateDesign = async () => {
        try {
            setIsGenerating(true)
            const snapshot = await generateFrameSnapshot(shape, allShapes)

            downloadBlob(snapshot, `frame-${shape.frameNumber}-snapshot.png`)

            const formData = new FormData()
            formData.append('image', snapshot, `frame-${shape.frameNumber}.png`)
            formData.append('frameNumber', shape.frameNumber.toString())

            const urlParams = new URLSearchParams(window.location.search)
            const projectId = urlParams.get('project')
            if (projectId) {
                formData.append('projectId', projectId)
            }
            const response = await fetch('/api/generate', {
                method: 'POST',
                body: formData,
            })
            // if (!response.ok) {
            //     const errorText = await response.text()
            //     throw new Error(
            //         `API request failed: ${response.status} ${response.statusText} - ${errorText}`
            //     )
            // }

            const generatedUIPosition = {
                x: shape.x + shape.w + 50, // 50px spacing from frame
                y: shape.y,
                w: Math.max(400, shape.w), // At least 400px wide, or frame width if larger
                h: Math.max(300, shape.h), // At least 300px high, or frame height if larger
            }
            const generatedUIId = nanoid()

            dispatch(
                addGeneratedUI({
                    ...generatedUIPosition,
                    id: generatedUIId,
                    uiSpecData: null, // Start with null for live rendering
                    sourceFrameId: shape.id,
                })
            )

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let accumulatedMarkup = ''

            let lastUpdateTime = 0
            const UPDATE_THROTTLE_MS = 200

            if (reader) {
                try {
                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) {
                            // Update with final accumulated markup
                            dispatch(
                                updateShape({
                                    id: generatedUIId,
                                    patch: { uiSpecData: accumulatedMarkup },
                                })
                            )
                            break
                        }
                        const chunk = decoder.decode(value)
                        accumulatedMarkup += chunk

                        const now = Date.now()
                        if (now - lastUpdateTime >= UPDATE_THROTTLE_MS) {
                            dispatch(
                                updateShape({
                                    id: generatedUIId,
                                    patch: { uiSpecData: accumulatedMarkup },
                                })
                            )
                            lastUpdateTime = now
                        }
                    }
                } finally {
                    reader.releaseLock()
                }
            }
        } catch (error) {
            toast.error(
                `Failed to generate UI design: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
        }
        finally {
            setIsGenerating(false)
        }
    }

    return {
        isGenerating,
        handleGenerateDesign,
    }
}

export const useInspiration = () => {
    const [isInspirationOpen, setIsInspirationOpen] = useState(false)

    const toggleInspiration = () => {
        setIsInspirationOpen(!isInspirationOpen)
    }

    const openInspiration = () => {
        setIsInspirationOpen(true)
    }
    const closeInspiration = () => {
        setIsInspirationOpen(false)
    }
    return {
        isInspirationOpen,
        toggleInspiration,
        openInspiration,
        closeInspiration,
    }
}

export const useWorkflowGeneration = () => {
    const dispatch = useAppDispatch()
    const [, { isLoading: isGeneratingWorkflow }] =
        useGenerateWorkflowMutation()

    const allShapes = useAppSelector((state) =>
        Object.values(state.shapes.shapes?.entities || {}).filter(
            (shape): shape is Shape => shape !== undefined
        )
    )
    const generateWorkflow = async (generatedUIId: string) => {
        try {
            const currentShape = allShapes.find((shape) => shape.id
                === generatedUIId)

            if (!currentShape || currentShape.type !== 'generatedui') {
                toast.error('Generated UI not found')
                return
            }
            console.log(currentShape)
            if (!currentShape.uiSpecData) {
                toast.error('No design data to generate workflow from')
                return
            }
            const urlParams = new URLSearchParams(window.location.search)
            const projectId = urlParams.get('project')

            if (!projectId) {
                toast.error('Project ID not found')
                return
            }
            const pageCount = 4;
            toast.loading(`Generating ${pageCount} pages workflow...`)

            const baseX = currentShape.x + currentShape.w + 100
            const spacing = Math.max(currentShape.w + 50, 450)

            const workflowPromises = Array.from({ length: pageCount }).map(
                async (_, index) => {
                    try {
                        const response = await fetch('/api/generate/workflow', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                generatedUIId,
                                currentHTML: currentShape.uiSpecData,
                                projectId,
                                pageIndex: index,
                            }),
                        })
                        if (!response.ok) {
                            throw new Error(
                                `Failed to generate page ${index + 1}: ${response.status}`
                            )
                        }
                        const workflowPosition = {
                            x: baseX + index * spacing,
                            y: currentShape.y,
                            w: Math.max(400, currentShape.w), // At least 400px wide
                            h: Math.max(300, currentShape.h), // At least 300px high
                        }
                        const workflowId = nanoid()
                        dispatch(
                            addGeneratedUI({
                                ...workflowPosition,
                                id: workflowId,
                                uiSpecData: null,
                                sourceFrameId: currentShape.sourceFrameId,
                                isWorkflowPage: true,
                            })
                        )

                        const reader = response.body?.getReader()
                        const decoder = new TextDecoder()
                        let accumulatedHTML = ''

                        if (reader) {
                            while (true) {
                                const { done, value } = await reader.read()
                                if (done) break

                                const chunk = decoder.decode(value)
                                accumulatedHTML += chunk

                                // Update the workflow page with streamed HTML
                                dispatch(
                                    updateShape({
                                        id: workflowId,
                                        patch: { uiSpecData: accumulatedHTML },
                                    })
                                )
                            }
                        }
                        return { pageIndex: index, succes: true }
                    } catch (error) {
                        console.log(`Error generating page ${index + 1}:`, error)
                        return { pageIndex: index, succes: false, error }
                    }
                }
            )
            const results = await Promise.all(workflowPromises)
            const successCount = results.filter((r) => r.succes).length
            const failedCount = results.filter((r) => !r.succes).length
            if (successCount === 4) {
                toast.success(`All 4 workflow pages generated successfully!`, {
                    id: 'workflow-generation'
                })
            }
            else if (successCount > 0) {
                toast.error(`Generated ${successCount} pages out of 4`, {
                    id: 'workflow-generation'
                })
                if (failedCount > 0) {
                    toast.error(`Failed to generate ${failedCount} pages`)
                }
            }
            else {
                toast.error(`Failed to generate workflow pages`, {
                    id: 'workflow-generation'
                })
            }
        }
        catch (error) {
            console.log(`Workflow generation error:`, error)
            toast.error(`Failed to generate workflow pages`, {
                id: 'workflow-generation'
            })
        }
    }
    return {
        generateWorkflow,
        isGeneratingWorkflow
    }
}

//TODO: add chat window complete the open chat close chate and toggle
export const useGlobalChat = () => {
    const [isChatOpen, setIsChatOpen] = useState(false)
    const [activeGeneratedUIId, setActiveGeneratedUIId] = useState<string | null>(
        null
    )
    const { generateWorkflow } = useWorkflowGeneration()


    const exportDesign = async (
        generatedUIId: string,
        element: HTMLElement | null
    ) => {
        if (!element) {
            console.warn('No element to export for shape:', generatedUIId)
            toast.error('No design element found for export.')
            return
        }
        try {
            const filename = `generated-ui-${generatedUIId.slice(0, 8)}.png`
            console.log(' Starting snapshot export:', { filename })
            await exportGeneratedUIAsPNG(element, filename)
            toast.success('Design exported successfully!')
        } catch (error) {
            console.error('Failed to export GeneratedUI:', error)
            toast.error('Failed to export design. Please try again.')
        }
    }
    const openChat = (generatedUIId: string) => {
        setActiveGeneratedUIId(generatedUIId)
        setIsChatOpen(true)
    }
    const closeChat = () => {
        setIsChatOpen(false)
        setActiveGeneratedUIId(null)
    }

    const toggleChat = (generatedUIId: string) => {
        if (isChatOpen && activeGeneratedUIId === generatedUIId) {
            closeChat()
        } else {
            openChat(generatedUIId)
        }
    }

    return {
        isChatOpen,
        activeGeneratedUIId,
        generateWorkflow,
        exportDesign,
        openChat,
        closeChat,
        toggleChat
    }
}

export const useChatWindow = (generatedUIId: string, isOpen: boolean) => {
    const [inputValue, setInputValue] = useState('')
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const dispatch = useAppDispatch()
    const chatState = useAppSelector(
        (state) =>
            state.chat.chats[generatedUIId] ?? {
                messages: [],
                isStreaming: false,
            }
    )

    const currentShape = useAppSelector(
        (state) => state.shapes.shapes.entities[generatedUIId]
    )
    const allShapes = useAppSelector((state) => state.shapes.shapes.entities)

    const getSourceFrame = (): FrameShape | null => {
        if (!currentShape || currentShape.type !== "generatedui") return null

        const sourceFrameId = currentShape.sourceFrameId
        if (!sourceFrameId) return null

        return allShapes[sourceFrameId] as FrameShape
    }

    useEffect(() => {
        if (isOpen) {
            dispatch(initializeChat(generatedUIId))
        }
    }, [generatedUIId, dispatch, isOpen])

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop =
                scrollAreaRef.current.scrollHeight
        }
    }, [chatState?.messages])


    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }, [isOpen])

    const handleSendMessage = async () => {
        if (!inputValue.trim() || chatState?.isStreaming) return

        const message = inputValue.trim()
        setInputValue('')

        try {
            dispatch(addUserMessage({ generatedUIId, content: message }))
            const responseId = `response-${Date.now()}`
            dispatch(startStreamingResponse({ generatedUIId, messageId: responseId }))

            const isWorkflowPage =
                currentShape?.type === 'generatedui' && currentShape.isWorkflowPage

            const urlParams = new URLSearchParams(window.location.search)
            const projectId = urlParams.get('project')

            if (!projectId) {
                throw new Error('Project ID not found in URL')
            }
            const baseRequestData = {
                userMessage: message,
                generatedUIId: generatedUIId,
                currentHTML:
                    currentShape?.type === 'generatedui' ? currentShape.uiSpecData : null,
                projectId: projectId, // Pass projectId in body
            }

            let apiEndpoint = '/api/generate/redesign'
            let wireframeSnapshot: string | null = null

            if (isWorkflowPage) {
                apiEndpoint = '/api/generate/workflow-redesign'
            } else {
                const sourceFrame = getSourceFrame()
                if (sourceFrame && sourceFrame.type === 'frame') {
                    try {
                        const allShapesArray = Object.values(allShapes).filter(
                            Boolean
                        ) as Shape[]
                        const snapshot = await generateFrameSnapshot(
                            sourceFrame,
                            allShapesArray
                        )
                        const arrayBuffer = await snapshot.arrayBuffer()
                        const base64 = btoa(
                            String.fromCharCode(...new Uint8Array(arrayBuffer))
                        )
                        wireframeSnapshot = base64
                    } catch (error) {
                        console.warn('Failed to generate wireframe snapshot:', error)
                    }
                }
                else {
                    console.warn('No source frame available for wireframe snapshot')
                }
            }

            const requestData = isWorkflowPage ? baseRequestData
                : {
                    ...baseRequestData,
                    wireframeSnapshot
                }
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
            })
            if (!response.ok) {
                throw new Error(`API request failed: ${response.statusText}`)
            }
            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let accumulatedHTML = ''
            if (reader) {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    const chunk = decoder.decode(value)
                    accumulatedHTML += chunk

                    dispatch(
                        updateStreamingContent({
                            generatedUIId,
                            messageId: responseId,
                            content: 'Regenerating your design ... ',
                        })
                    )

                    dispatch(
                        updateShape({
                            id: generatedUIId,
                            patch: {
                                uiSpecData: accumulatedHTML
                            }
                        })
                    )
                }
            }
            dispatch(
                finishStreamingResponse({ generatedUIId, messageId: responseId, finalContent: "Design Regenerated Successfully" })
            )
        } catch (error) {
            console.error('Chat error:', error)
            dispatch(
                addErrorMessage({
                    generatedUIId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                })
            )
            toast.error('Failed to regenerate design')
        }
    }
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }

    }

    const handleClearChat = () => {
        dispatch(clearChat(generatedUIId))
    }


    return {
        inputValue,
        setInputValue,
        scrollAreaRef,
        inputRef,
        handleSendMessage,
        handleKeyPress,
        handleClearChat,
        chatState
    }

}
















