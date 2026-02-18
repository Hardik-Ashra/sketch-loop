import { LiquidGlassButton } from "@/components/buttons/liquid-glass";
import { useUpdateContainer } from "@/hooks/use-styles";
import { GeneratedUIShape } from "@/redux/slices/shapes";
import { Download, MessageCircle, Workflow } from "lucide-react";
import React from "react";

type Props = {
  shape: GeneratedUIShape;
  toggleChat: (generatedUIId: string) => void;
  generateWorkflow: (generatedUIId: string) => void;
  exportDesign: (generatedUIId: string, element: HTMLElement | null) => void;
};

const GeneratedUI = ({
  shape,
  toggleChat,
  generateWorkflow,
  exportDesign,
}: Props) => {
  const handleExportDesign = async () => {
    if (!shape.uiSpecData) {
      console.warn("No UI data to export");
      return;
    }

    // ⭐ wait for next paint so ref is guaranteed mounted
    await new Promise(requestAnimationFrame);

    if (!containerRef.current) {
      console.warn("Container ref is null — trying DOM fallback");

      const fallback = document.querySelector(
        `[data-generated-ui-id="${shape.id}"]`,
      ) as HTMLElement | null;

      exportDesign(shape.id, fallback);
      return;
    }

    exportDesign(shape.id, containerRef.current);
  };

  const handleToggleChat = () => {
    toggleChat(shape.id);
  };

  const { sanitizeHtml, containerRef } = useUpdateContainer(shape);

  return (
    <div
      ref={containerRef}
      className="absolute pointer-events-none"
      style={{
        left: shape.x,
        top: shape.y,
        width: shape.w,
        height: "auto", // Auto height to grow with content
      }}
    >
      <div
        className="w-full h-auto relative rounded-lg border border-white/20 bg-white/5 backdrop-blur-sm"
        style={{
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          padding: "16px",
          height: "auto", // Auto height to fit content
          minHeight: "120px", // Minimum height for empty state
          position: "relative", // Contain absolutely positioned elements
        }}
      >
        <div
          className="h-auto w-full"
          style={{
            pointerEvents: "auto",
            height: "auto",
            maxWidth: "100%", // Prevent horizontal overflow
            boxSizing: "border-box", // Include padding in calculations
          }}
        >
          <div className="absolute -top-8 right-0 flex gap-2">
            <LiquidGlassButton
              size="sm"
              variant="subtle"
              onClick={handleExportDesign}
              disabled={!shape.uiSpecData}
              style={{ pointerEvents: "auto" }}
            >
              <Download size={12} />
              Export
            </LiquidGlassButton>
            <LiquidGlassButton
              size="sm"
              variant="subtle"
              onClick={() => generateWorkflow(shape.id)}
              style={{ pointerEvents: "auto" }}
            >
              <Workflow size={12} />
              Generate Workflow
            </LiquidGlassButton>
            <LiquidGlassButton
              size="sm"
              variant="subtle"
              onClick={handleToggleChat}
              style={{ pointerEvents: "auto" }}
            >
              <MessageCircle size={12} />
              Design Chat
            </LiquidGlassButton>
          </div>

          {shape.uiSpecData ? (
            <div
              className="h-auto"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(shape.uiSpecData),
              }}
            />
          ) : (
            <div className="flex items-center justify-center p-8 text-white/60">
              <div className="animate-pulse">Generating design ...</div>
            </div>
          )}
        </div>
      </div>
      <div
        className="absolute -top-6 left-0 text-xs px-2 py-1 rounded whitespace-nowrap text-white/60 bg-black/40"
        style={{ fontSize: "10px" }}
      >
        Generated UI
      </div>
    </div>
  );
};

export default GeneratedUI;
