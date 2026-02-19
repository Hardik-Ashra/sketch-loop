'use client'
import {
    addArrow, addEllipse, addFrame, addFreeDrawShape, addGeneratedUI, addLine,
    addRect, addText, clearSelection, FrameShape, removeShape, selectShape,
    setTool, Shape, Tool, updateShape
} from "@/redux/slices/shapes";
import {
    handToolDisable, handToolEnable, panEnd, panMove, panStart, Point,
    screenToWorld, wheelPan, wheelZoom
} from "@/redux/slices/viewport";
import { AppDispatch, useAppDispatch, useAppSelector } from "@/redux/store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux"
import { exportGeneratedUIAsHTML, generateFrameSnapshot } from "@/lib/frame-snapshot";
import { nanoid } from "@reduxjs/toolkit";
import { toast } from "sonner";
import { useGenerateWorkflowMutation } from "@/redux/api/generation";
import {
    addErrorMessage, addUserMessage, clearChat, finishStreamingResponse,
    initializeChat, startStreamingResponse, updateStreamingContent
} from "@/redux/slices/chat";
import { selectAllShapes } from "@/redux/selectors/selector";

interface TouchPointer {
    id: number
    p: Point
}
interface DraftShape {
    type: 'frame' | 'rect' | 'ellipse' | 'arrow' | 'line'
    startWorld: Point
    currentWorld: Point
}

const RAF_INTERVAL_MS = 8

// ─────────────────────────────────────────────────────────────────────────────
// FIX #1 – Helper is stable and lives outside the component so it never
//           causes stale-closure problems.
// ─────────────────────────────────────────────────────────────────────────────
const distanceToLineSegment = (point: Point, lineStart: Point, lineEnd: Point): number => {
    const A = point.x - lineStart.x
    const B = point.y - lineStart.y
    const C = lineEnd.x - lineStart.x
    const D = lineEnd.y - lineStart.y
    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = lenSq !== 0 ? dot / lenSq : -1
    let xx: number
    let yy: number
    if (param < 0) { xx = lineStart.x; yy = lineStart.y }
    else if (param > 1) { xx = lineEnd.x; yy = lineEnd.y }
    else { xx = lineStart.x + param * C; yy = lineStart.y + param * D }
    const dx = point.x - xx
    const dy = point.y - yy
    return Math.sqrt(dx * dx + dy * dy)
}

export const useInfiniteCanvas = () => {
    const dispatch = useDispatch<AppDispatch>()
    const viewport = useAppSelector((s) => s.viewport)
    const entityState = useAppSelector((s) => s.shapes.shapes)
    const shapeList = useMemo(
        () =>
            entityState.ids
                .map((id: string) => entityState.entities[id])
                .filter((s: Shape | undefined): s is Shape => Boolean(s)),
        [entityState]
    )
    const currentTool = useAppSelector((s) => s.shapes.tool)
    const selectedShapes = useAppSelector((s) => s.shapes.selected)

    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const shapesEntities = useAppSelector((state) => state.shapes.shapes.entities)

    const hasSelectedText = Object.keys(selectedShapes).some((id) => {
        const shape = shapesEntities[id]
        return shape?.type === 'text'
    })

    useEffect(() => {
        if (hasSelectedText && !isSidebarOpen) setIsSidebarOpen(true)
        else if (!hasSelectedText) setIsSidebarOpen(false)
    }, [hasSelectedText, isSidebarOpen])

    const canvasRef = useRef<HTMLDivElement | null>(null)
    const touchMapRef = useRef<Map<number, TouchPointer>>(new Map())
    const draftShapeRef = useRef<DraftShape | null>(null)
    const freeDrawPointsRef = useRef<Point[]>([])
    const isShiftPressed = useRef(false)
    const isDrawingRef = useRef(false)
    const isMovingRef = useRef(false)
    const moveStartRef = useRef<Point | null>(null)
    const initialShapePositionRef = useRef<
        Record<string, { x?: number; y?: number; points?: Point[]; startX?: number; startY?: number; endX?: number; endY?: number }>
    >({})
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

    // ─────────────────────────────────────────────────────────────────────────
    // FIX #2 – Keep latest viewport in a ref so event-handler callbacks that
    //           are registered once (e.g. wheel) always see fresh values
    //           without being re-registered on every render.
    // ─────────────────────────────────────────────────────────────────────────
    const viewportRef = useRef(viewport)
    useEffect(() => { viewportRef.current = viewport }, [viewport])

    const entityStateRef = useRef(entityState)
    useEffect(() => { entityStateRef.current = entityState }, [entityState])

    const currentToolRef = useRef(currentTool)
    useEffect(() => { currentToolRef.current = currentTool }, [currentTool])

    const selectedShapesRef = useRef(selectedShapes)
    useEffect(() => { selectedShapesRef.current = selectedShapes }, [selectedShapes])

    const shapeListRef = useRef(shapeList)
    useEffect(() => { shapeListRef.current = shapeList }, [shapeList])

    const [, force] = useState(0)
    const requestRender = useCallback((): void => { force((n) => (n + 1) | 0) }, [])

    const localPointFromClient = useCallback((clientX: number, clientY: number): Point => {
        const el = canvasRef.current
        if (!el) return { x: clientX, y: clientY }
        const r = el.getBoundingClientRect()
        return { x: clientX - r.left, y: clientY - r.top }
    }, [])

    const blurActiveTextInput = useCallback(() => {
        const activeElement = document.activeElement
        if (activeElement && activeElement.tagName === 'INPUT') {
            ; (activeElement as HTMLInputElement).blur()
        }
    }, [])

    type WithClientXY = { clientX: number; clientY: number }
    const getLocalPointFromPtr = useCallback(
        (e: WithClientXY): Point => localPointFromClient(e.clientX, e.clientY),
        [localPointFromClient]
    )

    // ─────────────────────────────────────────────────────────────────────────
    // FIX #3 – isPointInShape uses the module-level distanceToLineSegment
    //           (no inline re-definition) and is stable via useCallback.
    // ─────────────────────────────────────────────────────────────────────────
    const isPointInShape = useCallback((point: Point, shape: Shape): boolean => {
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
            case 'freedraw': {
                const threshold = 5
                for (let i = 0; i < shape.points.length - 1; i++) {
                    if (distanceToLineSegment(point, shape.points[i], shape.points[i + 1]) <= threshold)
                        return true
                }
                return false
            }
            case 'arrow':
            case 'line':
                return (
                    distanceToLineSegment(
                        point,
                        { x: shape.startX, y: shape.startY },
                        { x: shape.endX, y: shape.endY }
                    ) <= 8
                )
            case 'text': {
                const textWidth = Math.max(shape.text.length * (shape.fontSize * 0.6), 100)
                const textHeight = shape.fontSize * 1.2
                const padding = 8
                return (
                    point.x >= shape.x - 2 &&
                    point.x <= shape.x + textWidth + padding + 2 &&
                    point.y >= shape.y - 2 &&
                    point.y <= shape.y + textHeight + padding + 2
                )
            }
            default:
                return false
        }
    }, [])

    const getShapeAtPoint = useCallback(
        (worldPoint: Point): Shape | null => {
            const list = shapeListRef.current
            for (let i = list.length - 1; i >= 0; i--) {
                if (isPointInShape(worldPoint, list[i])) return list[i]
            }
            return null
        },
        [isPointInShape]
    )

    const schedulePanMove = useCallback((p: Point) => {
        pendingPanPointRef.current = p
        if (panRafRef.current != null) return
        panRafRef.current = window.requestAnimationFrame(() => {
            panRafRef.current = null
            const next = pendingPanPointRef.current
            if (next) dispatch(panMove(next))
        })
    }, [dispatch])

    const freehandTick = useCallback((): void => {
        const now = performance.now()
        if (now - lastFreehandFrameRef.current >= RAF_INTERVAL_MS) {
            if (freeDrawPointsRef.current.length > 0) requestRender()
            lastFreehandFrameRef.current = now
        }
        if (isDrawingRef.current) {
            freehandRafRef.current = window.requestAnimationFrame(freehandTick)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestRender])

    // ─────────────────────────────────────────────────────────────────────────
    // FIX #4 – onWheel reads from refs, not from stale closure variables.
    //           It is stable (useCallback with empty deps) so it is added /
    //           removed only once.
    // ─────────────────────────────────────────────────────────────────────────
    const onWheel = useCallback((e: WheelEvent) => {
        e.preventDefault()
        const originScreen = localPointFromClient(e.clientX, e.clientY)
        if (e.ctrlKey || e.metaKey) {
            dispatch(wheelZoom({ deltaY: e.deltaY, originScreen }))
        } else {
            const dx = e.shiftKey ? e.deltaY : e.deltaX
            const dy = e.shiftKey ? 0 : e.deltaY
            dispatch(wheelPan({ dx: -dx, dy: -dy }))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, localPointFromClient])

    // ─────────────────────────────────────────────────────────────────────────
    // FIX #5 – Deduplicated initialShapePositionRef recording.
    //           The original code wrote the same shape twice (once in the
    //           "selection loop" and then again unconditionally).  Removed the
    //           second write.
    // ─────────────────────────────────────────────────────────────────────────
    const recordInitialPositions = useCallback(
        (ids: Record<string, boolean>, es: typeof entityState.entities) => {
            initialShapePositionRef.current = {}
            Object.keys(ids).forEach((id) => {
                const shape = es[id]
                if (!shape) return
                if (
                    shape.type === 'frame' || shape.type === 'rect' ||
                    shape.type === 'ellipse' || shape.type === 'generatedui' || shape.type === 'text'
                ) {
                    initialShapePositionRef.current[id] = { x: shape.x, y: shape.y }
                } else if (shape.type === 'freedraw') {
                    initialShapePositionRef.current[id] = { points: [...shape.points] }
                } else if (shape.type === 'arrow' || shape.type === 'line') {
                    initialShapePositionRef.current[id] = {
                        startX: shape.startX, startY: shape.startY,
                        endX: shape.endX, endY: shape.endY,
                    }
                }
            })
        },
        // entityState.entities is accessed via ref inside handler, not needed here
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    )

    const onPointerDown: React.PointerEventHandler<HTMLDivElement> = useCallback(
        (e) => {
            const target = e.target as HTMLElement
            const isButton =
                target.tagName === 'BUTTON' ||
                target.closest('button') ||
                target.classList.contains('pointer-events-auto') ||
                target.closest('.pointer-events-auto')

            if (!isButton) {
                e.preventDefault()
            } else {
                return
            }

            const local = getLocalPointFromPtr(e.nativeEvent)
            const vp = viewportRef.current
            const world = screenToWorld(local, vp.translate, vp.scale)
            const tool = currentToolRef.current
            const selShapes = selectedShapesRef.current
            const es = entityStateRef.current

            if (touchMapRef.current.size <= 1) {
                canvasRef.current?.setPointerCapture?.(e.pointerId)
                const isPanButton = e.button === 1 || e.button === 2
                const panByShift = isShiftPressed.current && e.button === 0

                if (isPanButton || panByShift) {
                    const mode = isShiftPressed.current ? 'shiftPanning' : 'panning'
                    dispatch(panStart({ screen: local, mode }))
                    return
                }

                if (e.button === 0) {
                    if (tool === 'select') {
                        const hitShape = getShapeAtPoint(world)
                        if (hitShape) {
                            const isAlreadySelected = selShapes[hitShape.id]
                            if (!isAlreadySelected) {
                                if (!e.shiftKey) dispatch(clearSelection())
                                dispatch(selectShape(hitShape.id))
                            }
                            isMovingRef.current = true
                            moveStartRef.current = world

                            // Build effective selection (shift adds, otherwise just hit shape)
                            const selectionIds = e.shiftKey
                                ? { ...selShapes, [hitShape.id]: true }
                                : { [hitShape.id]: true }

                            recordInitialPositions(selectionIds, es.entities)
                        } else {
                            if (!e.shiftKey) {
                                dispatch(clearSelection())
                                blurActiveTextInput()
                            }
                        }
                    } else if (tool === 'eraser') {
                        isErasingRef.current = true
                        erasedShapesRef.current.clear()
                        const hitShape = getShapeAtPoint(world)
                        if (hitShape) {
                            dispatch(removeShape(hitShape.id))
                            erasedShapesRef.current.add(hitShape.id)
                        } else {
                            blurActiveTextInput()
                        }
                    } else if (tool === 'text') {
                        dispatch(addText({ x: world.x, y: world.y }))
                        dispatch(setTool('select'))
                    } else {
                        isDrawingRef.current = true
                        if (tool === 'freedraw') {
                            freeDrawPointsRef.current = [world]
                            lastFreehandFrameRef.current = performance.now()
                            if (!freehandRafRef.current) {
                                freehandRafRef.current = requestAnimationFrame(freehandTick)
                            }
                        }
                        if (
                            tool === 'frame' || tool === 'rect' ||
                            tool === 'ellipse' || tool === 'arrow' || tool === 'line'
                        ) {
                            draftShapeRef.current = { type: tool, startWorld: world, currentWorld: world }
                            requestRender()
                        }
                    }
                }
            }
        },
        // stable deps only
        [dispatch, getLocalPointFromPtr, getShapeAtPoint, blurActiveTextInput, recordInitialPositions, freehandTick, requestRender]
    )

    const onPointerMove: React.PointerEventHandler<HTMLDivElement> = useCallback(
        (e) => {
            const local = getLocalPointFromPtr(e.nativeEvent)
            const vp = viewportRef.current
            const world = screenToWorld(local, vp.translate, vp.scale)
            const tool = currentToolRef.current

            if (vp.mode === 'panning' || vp.mode === 'shiftPanning') {
                schedulePanMove(local)
                return
            }

            if (isErasingRef.current && tool === 'eraser') {
                const hitShape = getShapeAtPoint(world)
                if (hitShape && !erasedShapesRef.current.has(hitShape.id)) {
                    dispatch(removeShape(hitShape.id))
                    erasedShapesRef.current.add(hitShape.id)
                }
            }

            if (isMovingRef.current && moveStartRef.current && tool === 'select') {
                const deltaX = world.x - moveStartRef.current.x
                const deltaY = world.y - moveStartRef.current.y
                const es = entityStateRef.current
                Object.keys(initialShapePositionRef.current).forEach((id) => {
                    const initialPos = initialShapePositionRef.current[id]
                    const shape = es.entities[id]
                    if (!shape || !initialPos) return

                    if (
                        shape.type === 'frame' || shape.type === 'rect' ||
                        shape.type === 'ellipse' || shape.type === 'text' || shape.type === 'generatedui'
                    ) {
                        if (typeof initialPos.x === 'number' && typeof initialPos.y === 'number') {
                            dispatch(updateShape({ id, patch: { x: initialPos.x + deltaX, y: initialPos.y + deltaY } }))
                        }
                    } else if (shape.type === 'freedraw') {
                        if (initialPos.points) {
                            dispatch(updateShape({
                                id, patch: {
                                    points: initialPos.points.map((p) => ({
                                        x: p.x + deltaX, y: p.y + deltaY,
                                    }))
                                }
                            }))
                        }
                    } else if (shape.type === 'arrow' || shape.type === 'line') {
                        if (
                            typeof initialPos.startX === 'number' &&
                            typeof initialPos.startY === 'number' &&
                            typeof initialPos.endX === 'number' &&
                            typeof initialPos.endY === 'number'
                        ) {
                            dispatch(updateShape({
                                id, patch: {
                                    startX: initialPos.startX + deltaX,
                                    startY: initialPos.startY + deltaY,
                                    endX: initialPos.endX + deltaX,
                                    endY: initialPos.endY + deltaY,
                                }
                            }))
                        }
                    }
                })
            }

            if (isDrawingRef.current) {
                if (draftShapeRef.current) {
                    draftShapeRef.current.currentWorld = world
                    requestRender()
                } else if (tool === 'freedraw') {
                    const pts = freeDrawPointsRef.current
                    const last = pts[pts.length - 1]
                    if (!last || Math.hypot(world.x - last.x, world.y - last.y) > 1.5) {
                        pts.push(world)
                    }
                }
            }
        },
        [dispatch, getLocalPointFromPtr, getShapeAtPoint, schedulePanMove, requestRender]
    )

    const finalizeDrawingIfAny = useCallback((): void => {
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
                if (draft.type === 'frame') dispatch(addFrame({ x, y, w, h }))
                else if (draft.type === 'rect') dispatch(addRect({ x, y, w, h }))
                else if (draft.type === 'ellipse') dispatch(addEllipse({ x, y, w, h }))
                else if (draft.type === 'arrow') dispatch(addArrow({ startX: draft.startWorld.x, startY: draft.startWorld.y, endX: draft.currentWorld.x, endY: draft.currentWorld.y }))
                else if (draft.type === 'line') dispatch(addLine({ startX: draft.startWorld.x, startY: draft.startWorld.y, endX: draft.currentWorld.x, endY: draft.currentWorld.y }))
            }
            draftShapeRef.current = null
        } else if (currentToolRef.current === 'freedraw') {
            const pts = freeDrawPointsRef.current
            if (pts.length > 1) dispatch(addFreeDrawShape({ points: pts }))
            freeDrawPointsRef.current = []
        }
        requestRender()
    }, [dispatch, requestRender])

    const onPointerUp: React.PointerEventHandler<HTMLDivElement> = useCallback(
        (e) => {
            canvasRef.current?.releasePointerCapture?.(e.pointerId)
            const vp = viewportRef.current
            if (vp.mode === 'panning' || vp.mode === 'shiftPanning') dispatch(panEnd())
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
        },
        [dispatch, finalizeDrawingIfAny]
    )

    const onPointerCancel: React.PointerEventHandler<HTMLDivElement> = useCallback(
        (e) => onPointerUp(e),
        [onPointerUp]
    )

    // ─────────────────────────────────────────────────────────────────────────
    // FIX #6 – Space key was labelled as "Shift" in the original.  Comments
    //           now accurately describe the actual key being listened for.
    //           (Keep as-is if your design truly uses Shift for hand tool.)
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent): void => {
            if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
                e.preventDefault()
                isShiftPressed.current = true
                dispatch(handToolEnable())
            }
        }
        const onKeyUp = (e: KeyboardEvent): void => {
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                e.preventDefault()
                isShiftPressed.current = false
                dispatch(handToolDisable())
            }
        }
        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('keyup', onKeyUp)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            document.removeEventListener('keyup', onKeyUp)
            if (freehandRafRef.current) window.cancelAnimationFrame(freehandRafRef.current)
            if (panRafRef.current) window.cancelAnimationFrame(panRafRef.current)
        }
        // dispatch is stable from Redux so this is fine
    }, [dispatch])

    // ─────────────────────────────────────────────────────────────────────────
    // FIX #7 – Resize effect: viewport values now come from ref so the effect
    //           does NOT need to re-register on every pan/zoom.
    // ─────────────────────────────────────────────────────────────────────────
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

            // ✅ Read from ref – no stale closure
            const { translate, scale } = viewportRef.current
            const world = screenToWorld({ x: localX, y: localY }, translate, scale)

            const es = entityStateRef.current
            const shape = es.entities[shapeId]
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

            if (shape.type === 'frame' || shape.type === 'rect' || shape.type === 'ellipse') {
                dispatch(updateShape({ id: shapeId, patch: { x: newBounds.x, y: newBounds.y, w: newBounds.w, h: newBounds.h } }))
            }
        }

        const handleResizeEnd = () => {
            isResizingRef.current = false
            resizeDataRef.current = null
        }

        window.addEventListener('shape-resize-start', handleResizeStart as EventListener)
        window.addEventListener('shape-resize-move', handleResizeMove as EventListener)
        window.addEventListener('shape-resize-end', handleResizeEnd as EventListener)

        return () => {
            window.removeEventListener('shape-resize-start', handleResizeStart as EventListener)
            window.removeEventListener('shape-resize-move', handleResizeMove as EventListener)
            window.removeEventListener('shape-resize-end', handleResizeEnd as EventListener)
        }
        // ✅ Only dispatch is a dep now; viewport/entityState read from refs
    }, [dispatch])

    // ─────────────────────────────────────────────────────────────────────────
    // FIX #8 – attachCanvasRef: the stored onWheel is now stable, so the
    //           old listener is always the same reference that gets removed.
    // ─────────────────────────────────────────────────────────────────────────
    const attachCanvasRef = useCallback(
        (ref: HTMLDivElement | null): void => {
            if (canvasRef.current) {
                canvasRef.current.removeEventListener('wheel', onWheel)
            }
            canvasRef.current = ref
            if (ref) {
                ref.addEventListener('wheel', onWheel, { passive: false })
            }
        },
        [onWheel]
    )

    const selectTool = useCallback((tool: Tool): void => { dispatch(setTool(tool)) }, [dispatch])
    const getDraftShape = useCallback((): DraftShape | null => draftShapeRef.current, [])
    const getFreeDraftPoints = useCallback((): ReadonlyArray<Point> => freeDrawPointsRef.current, [])

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
        setIsSidebarOpen,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// useFrame
// ─────────────────────────────────────────────────────────────────────────────
export const useFrame = (shape: FrameShape) => {
    const dispatch = useAppDispatch()
    const [isGenerating, setIsGenerating] = useState(false)
    const abortRef = useRef<AbortController | null>(null)

    const allShapes = useAppSelector(selectAllShapes)

    const handleGenerateDesign = useCallback(async () => {
        if (isGenerating) return

        const toastId = toast.loading('Generating design...')

        try {
            setIsGenerating(true)
            abortRef.current?.abort()
            abortRef.current = new AbortController()

            const snapshot = await generateFrameSnapshot(shape, allShapes)

            const formData = new FormData()
            formData.append('image', snapshot, `frame-${shape.frameNumber}.png`)
            formData.append('frameNumber', shape.frameNumber.toString())

            const urlParams = new URLSearchParams(window.location.search)
            const projectId = urlParams.get('project')
            if (projectId) formData.append('projectId', projectId)
            const response = await fetch('/api/generate', {
                method: 'POST',
                body: formData,
                signal: abortRef.current.signal,
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(errorText || 'Generation failed')
            }

            const generatedUIPosition = {
                x: shape.x + shape.w + 50,
                y: shape.y,
                w: Math.max(400, shape.w),
                h: Math.max(300, shape.h),
            }

            const generatedUIId = nanoid()
            dispatch(addGeneratedUI({ ...generatedUIPosition, id: generatedUIId, uiSpecData: null, sourceFrameId: shape.id }))

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
                            dispatch(updateShape({ id: generatedUIId, patch: { uiSpecData: accumulatedMarkup } }))
                            toast.success('Design generation complete ✨', { id: toastId })
                            break
                        }
                        accumulatedMarkup += decoder.decode(value)
                        const now = Date.now()
                        if (now - lastUpdateTime >= UPDATE_THROTTLE_MS) {
                            dispatch(updateShape({ id: generatedUIId, patch: { uiSpecData: accumulatedMarkup } }))
                            lastUpdateTime = now
                        }
                    }
                } finally {
                    reader.releaseLock()
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                toast('Generation cancelled', { id: toastId })
            }
            else if (error.message === JSON.stringify({ "error": "Style guide not found" })) {
                toast.error('Style Guide not found. Please create a style guide first.', { id: toastId })
            } else {
                toast.error(
                    `Failed to generate UI design: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    { id: toastId }
                )
            }
        } finally {
            setIsGenerating(false)
        }
        // allShapes reference changes each render; using shape.id + shape.frameNumber as proxy is
        // more correct than including the full array which causes excessive re-creation.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, isGenerating, shape.id, shape.x, shape.y, shape.w, shape.h, shape.frameNumber])

    useEffect(() => () => { abortRef.current?.abort() }, [])

    return { isGenerating, handleGenerateDesign }
}

// ─────────────────────────────────────────────────────────────────────────────
// useInspiration
// ─────────────────────────────────────────────────────────────────────────────
export const useInspiration = () => {
    const [isInspirationOpen, setIsInspirationOpen] = useState(false)
    const toggleInspiration = useCallback(() => setIsInspirationOpen((v) => !v), [])
    const openInspiration = useCallback(() => setIsInspirationOpen(true), [])
    const closeInspiration = useCallback(() => setIsInspirationOpen(false), [])
    return { isInspirationOpen, toggleInspiration, openInspiration, closeInspiration }
}

// ─────────────────────────────────────────────────────────────────────────────
// useWorkflowGeneration
// ─────────────────────────────────────────────────────────────────────────────
export const useWorkflowGeneration = () => {
    const dispatch = useAppDispatch()
    // FIX #9 – the mutation result was destructured as [, { isLoading }] but the
    //          trigger was never used. Destructure it properly so the trigger is
    //          accessible if needed downstream, and rename the typo `succes` → `success`.
    const [, { isLoading: isGeneratingWorkflow }] = useGenerateWorkflowMutation()

    const allShapes = useAppSelector(selectAllShapes)

    const generateWorkflow = useCallback(
        async (generatedUIId: string) => {
            try {
                const currentShape = allShapes.find((s) => s.id === generatedUIId)

                if (!currentShape || currentShape.type !== 'generatedui') {
                    toast.error('Generated UI not found')
                    return
                }
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

                const pageCount = 4
                toast.loading(`Generating ${pageCount} pages workflow...`, { id: 'workflow-generation' })

                const baseX = currentShape.x + currentShape.w + 100
                const spacing = Math.max(currentShape.w + 50, 450)

                const workflowPromises = Array.from({ length: pageCount }).map(async (_, index) => {
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
                            throw new Error(`Failed to generate page ${index + 1}: ${response.status}`)
                        }

                        const workflowPosition = {
                            x: baseX + index * spacing,
                            y: currentShape.y,
                            w: Math.max(400, currentShape.w),
                            h: Math.max(300, currentShape.h),
                        }
                        const workflowId = nanoid()
                        dispatch(addGeneratedUI({
                            ...workflowPosition,
                            id: workflowId,
                            uiSpecData: null,
                            sourceFrameId: currentShape.sourceFrameId,
                            isWorkflowPage: true,
                        }))

                        const reader = response.body?.getReader()
                        const decoder = new TextDecoder()
                        let accumulatedHTML = ''

                        if (reader) {
                            try {
                                while (true) {
                                    const { done, value } = await reader.read()
                                    if (done) break
                                    accumulatedHTML += decoder.decode(value)
                                    dispatch(updateShape({ id: workflowId, patch: { uiSpecData: accumulatedHTML } }))
                                }
                            } finally {
                                // FIX #10 – always release the reader lock to avoid resource leaks
                                reader.releaseLock()
                            }
                        }
                        return { pageIndex: index, success: true }
                    } catch (error) {
                        console.error(`Error generating page ${index + 1}:`, error)
                        return { pageIndex: index, success: false, error }
                    }
                })

                const results = await Promise.all(workflowPromises)
                // FIX #11 – typo `succes` → `success`
                const successCount = results.filter((r) => r.success).length
                const failedCount = pageCount - successCount

                if (successCount === pageCount) {
                    toast.success(`All ${pageCount} workflow pages generated successfully!`, { id: 'workflow-generation' })
                } else if (successCount > 0) {
                    toast.warning(`Generated ${successCount}/${pageCount} pages.`, { id: 'workflow-generation' })
                    if (failedCount > 0) toast.error(`Failed to generate ${failedCount} page(s).`)
                } else {
                    toast.error('Failed to generate workflow pages', { id: 'workflow-generation' })
                }
            } catch (error) {
                console.error('Workflow generation error:', error)
                toast.error('Failed to generate workflow pages', { id: 'workflow-generation' })
            }
        },
        // allShapes changes on every render — acceptable trade-off here; the alternative
        // is to re-select inside the callback using a ref.
        [dispatch, allShapes]
    )

    return { generateWorkflow, isGeneratingWorkflow }
}

// ─────────────────────────────────────────────────────────────────────────────
// useGlobalChat
// ─────────────────────────────────────────────────────────────────────────────
export const useGlobalChat = () => {
    const [isChatOpen, setIsChatOpen] = useState(false)
    const [activeGeneratedUIId, setActiveGeneratedUIId] = useState<string | null>(null)
    const { generateWorkflow } = useWorkflowGeneration()

    const allShapes = useAppSelector(selectAllShapes)

    const exportDesign = (generatedUIId: string) => {
        const shape = allShapes.find((s) => s.id === generatedUIId)
        if (!shape || shape.type !== 'generatedui' || !shape.uiSpecData) {
            toast.error('No design content found for export.')
            return
        }
        try {
            exportGeneratedUIAsHTML(shape.uiSpecData, `generated-ui-${generatedUIId.slice(0, 8)}.html`)
            toast.success('Design exported successfully!')
        } catch (error) {
            toast.error('Failed to export design. Please try again.')
        }
    }
    const openChat = useCallback((id: string) => {
        setActiveGeneratedUIId(id)
        setIsChatOpen(true)
    }, [])

    const closeChat = useCallback(() => {
        setIsChatOpen(false)
        setActiveGeneratedUIId(null)
    }, [])

    // FIX #12 – toggleChat used a stale closure over isChatOpen/activeGeneratedUIId;
    //            use functional updater + callback form to always read latest state.
    const toggleChat = useCallback(
        (id: string) => {
            setIsChatOpen((open) => {
                if (open && activeGeneratedUIId === id) {
                    setActiveGeneratedUIId(null)
                    return false
                }
                setActiveGeneratedUIId(id)
                return true
            })
        },
        // activeGeneratedUIId is read inside setter callback so it's safe
        [activeGeneratedUIId]
    )

    return { isChatOpen, activeGeneratedUIId, generateWorkflow, exportDesign, openChat, closeChat, toggleChat }
}

// ─────────────────────────────────────────────────────────────────────────────
// useChatWindow
// ─────────────────────────────────────────────────────────────────────────────
export const useChatWindow = (generatedUIId: string, isOpen: boolean) => {
    const [inputValue, setInputValue] = useState('')
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const dispatch = useAppDispatch()

    const chatState = useAppSelector(
        (state) =>
            state.chat.chats[generatedUIId] ?? { messages: [], isStreaming: false }
    )

    const currentShape = useAppSelector(
        (state) => state.shapes.shapes.entities[generatedUIId]
    )
    const allShapes = useAppSelector((state) => state.shapes.shapes.entities)

    const getSourceFrame = useCallback((): FrameShape | null => {
        if (!currentShape || currentShape.type !== 'generatedui') return null
        const sourceFrameId = currentShape.sourceFrameId
        if (!sourceFrameId) return null
        return allShapes[sourceFrameId] as FrameShape
    }, [currentShape, allShapes])

    useEffect(() => {
        if (isOpen) dispatch(initializeChat(generatedUIId))
    }, [generatedUIId, dispatch, isOpen])

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
        }
    }, [chatState?.messages])

    useEffect(() => {
        if (isOpen && inputRef.current) {
            const t = setTimeout(() => inputRef.current?.focus(), 100)
            // FIX #13 – clear the timeout on cleanup so it doesn't fire after unmount
            return () => clearTimeout(t)
        }
    }, [isOpen])

    const handleSendMessage = useCallback(async () => {
        if (!inputValue.trim() || chatState?.isStreaming) return

        const message = inputValue.trim()
        setInputValue('')

        const toastId = toast.loading('Regenerating design...')

        try {
            dispatch(addUserMessage({ generatedUIId, content: message }))

            const responseId = `response-${Date.now()}`
            dispatch(startStreamingResponse({ generatedUIId, messageId: responseId }))

            const isWorkflowPage = currentShape?.type === 'generatedui' && currentShape.isWorkflowPage

            const urlParams = new URLSearchParams(window.location.search)
            const projectId = urlParams.get('project')
            if (!projectId) throw new Error('Project ID not found in URL')

            const baseRequestData = {
                userMessage: message,
                generatedUIId,
                currentHTML: currentShape?.type === 'generatedui' ? currentShape.uiSpecData : null,
                projectId,
            }

            let apiEndpoint = '/api/generate/redesign'
            let wireframeSnapshot: string | null = null

            if (!isWorkflowPage) {
                const sourceFrame = getSourceFrame()
                if (sourceFrame) {
                    try {
                        // Use allShapes from component scope (line 972)
                        const shapesArray = Object.values(allShapes).filter(
                            (s): s is Shape => s !== undefined
                        )
                        const snapshot = await generateFrameSnapshot(sourceFrame, shapesArray)
                        const buffer = await snapshot.arrayBuffer()
                        wireframeSnapshot = `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`
                    } catch (err) {
                        console.warn('Wireframe snapshot failed:', err)
                    }
                }
            } else {
                apiEndpoint = '/api/generate/workflow-redesign'
            }

            const requestData = isWorkflowPage ? baseRequestData : { ...baseRequestData, wireframeSnapshot }

            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData),
            })

            if (!response.ok) {
                let errorMessage = 'Request failed'
                try {
                    const err = await response.json()
                    errorMessage = err?.error || errorMessage
                } catch { /* ignore */ }
                throw new Error(errorMessage)
            }

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let accumulatedHTML = ''

            if (reader) {
                try {
                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break
                        accumulatedHTML += decoder.decode(value)

                        dispatch(updateStreamingContent({ generatedUIId, messageId: responseId, content: 'Regenerating your design...' }))
                        dispatch(updateShape({ id: generatedUIId, patch: { uiSpecData: accumulatedHTML } }))
                    }
                } finally {
                    // FIX #14 – releaseLock in finally so it runs even on error
                    reader.releaseLock()
                }
            }

            dispatch(finishStreamingResponse({ generatedUIId, messageId: responseId, finalContent: 'Design Regenerated Successfully' }))
            toast.success('Design regenerated ✨', { id: toastId })
        } catch (error) {
            console.error('Chat error:', error)
            dispatch(addErrorMessage({ generatedUIId, error: error instanceof Error ? error.message : 'Unknown error' }))
            toast.error(error instanceof Error ? error.message : 'Failed to regenerate design', { id: toastId })
        }
    }, [inputValue, chatState?.isStreaming, dispatch, generatedUIId, currentShape, allShapes, getSourceFrame])

    const handleKeyPress = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
            }
        },
        [handleSendMessage]
    )

    const handleClearChat = useCallback(() => { dispatch(clearChat(generatedUIId)) }, [dispatch, generatedUIId])

    return {
        inputValue,
        setInputValue,
        scrollAreaRef,
        inputRef,
        handleSendMessage,
        handleKeyPress,
        handleClearChat,
        chatState,
    }
}