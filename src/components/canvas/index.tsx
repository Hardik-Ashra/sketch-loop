"use client";
import {
  useGlobalChat,
  useInfiniteCanvas,
  useInspiration,
} from "@/hooks/use-canvas";
import TextSidebar from "./text-sidebar";
import React from "react";
import { cn } from "@/lib/utils";
import { Shape } from "@/redux/slices/shapes";
import ShapeRenderer from "./shapes";
import { RectanglePreview } from "./shapes/rectangle/preview";
import { FramePreview } from "./shapes/frame/preview";
import { ElipsePreview } from "./shapes/elipse/preview";
import { LinePreview } from "./shapes/line/preview";
import { FreeDrawStrokePreview } from "./shapes/stroke/preview";
import { SelectionOverlay } from "./shapes/selection";
import InspirationSidebar from "./shapes/inspiration-sidebar";
import ChatWindow from "./shapes/generatedUi/chat";

const InfinityCanvas = () => {
  const {
    viewport,
    shapes,
    currentTool,
    selectedShapes,

    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,

    attachCanvasRef,
    getDraftShape,
    getFreeDraftPoints,
    isSidebarOpen,
    hasSelectedText,
  } = useInfiniteCanvas();

  const { isInspirationOpen, closeInspiration, toggleInspiration } =
    useInspiration();

  const {
    isChatOpen,
    activeGeneratedUIId,
    generateWorkflow,
    exportDesign,
    closeChat,
    toggleChat,
  } = useGlobalChat();

  const draftShape = getDraftShape();
  const freeDrawPoints = getFreeDraftPoints();
  return (
    <>
      <TextSidebar isOpen={isSidebarOpen && hasSelectedText} />
      <InspirationSidebar
        isOpen={isInspirationOpen}
        onClose={closeInspiration}
      />

      {activeGeneratedUIId && (
        <ChatWindow
          isOpen={isChatOpen}
          onClose={closeChat}
          generatedUIId={activeGeneratedUIId}
        />
      )}
      <div
        ref={attachCanvasRef}
        role="application"
        aria-label="Infinite Canvas"
        className={cn(
          "relative w-full h-full overflow-hidden select-none z-0",
          {
            "cursor-grabbing": viewport.mode === "panning",
            "cursor-grab": viewport.mode === "shiftPanning",
            "cursor-crosshair":
              currentTool !== "select" && viewport.mode === "idle",
            "cursor-default":
              currentTool === "select" && viewport.mode === "idle",
          },
        )}
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        draggable={false}
      >
        <div
          className="absolute origin-top-left pointer-events-none z-10 will-change-transform"
          style={{
            transform: `translate3d(${viewport.translate.x}px, ${viewport.translate.y}px, 0) scale(${viewport.scale})`,
            transformOrigin: "0 0",
            willChange: "transform",
          }}
        >
          {shapes.map((shape: Shape) => (
            <ShapeRenderer
              key={shape.id}
              shape={shape}
              toggleInspiration={toggleInspiration}
              toggleChat={toggleChat}
              generateWorkflow={generateWorkflow}
              exportDesign={exportDesign}
            />
          ))}
          {shapes.map((shape: Shape) => (
            <SelectionOverlay
              key={`selection-${shape.id}`}
              shape={shape}
              isSelected={!!selectedShapes[shape.id]}
            />
          ))}
          {draftShape && draftShape.type === "frame" && (
            <FramePreview
              startWorld={draftShape.startWorld}
              currentWorld={draftShape.currentWorld}
            />
          )}

          {draftShape && draftShape.type === "rect" && (
            <RectanglePreview
              startWorld={draftShape.startWorld}
              currentWorld={draftShape.currentWorld}
            />
          )}

          {draftShape && draftShape.type === "ellipse" && (
            <ElipsePreview
              startWorld={draftShape.startWorld}
              currentWorld={draftShape.currentWorld}
            />
          )}

          {draftShape && draftShape.type === "line" && (
            <LinePreview
              startWorld={draftShape.startWorld}
              currentWorld={draftShape.currentWorld}
            />
          )}

          {currentTool === "freedraw" && freeDrawPoints.length > 1 && (
            <FreeDrawStrokePreview points={freeDrawPoints} />
          )}
        </div>
      </div>
    </>
  );
};

export default InfinityCanvas;
