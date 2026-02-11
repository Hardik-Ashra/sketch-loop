"use client";
import { Button } from "@/components/ui/button";
import { useInfiniteCanvas } from "@/hooks/use-canvas";
import { cn } from "@/lib/utils";
import { Tool } from "@/redux/slices/shapes";
import {
  ArrowRight,
  Circle,
  Eraser,
  Hash,
  Minus,
  MousePointer2,
  Pencil,
  Square,
  Type,
} from "lucide-react";
import React from "react";

const tools: Array<{
  id: Tool;
  icon: React.ReactNode;
  label: string;
  description: string;
}> = [
  {
    id: "select",
    icon: <MousePointer2 className="w-4 h-4" />,
    label: "Select",
    description: "Select and move shapes",
  },
  {
    id: "frame",
    icon: <Hash className="w-4 h-4" />,
    label: "Frame",
    description: "Draw frame containers",
  },
  {
    id: "rect",
    icon: <Square className="w-4 h-4" />,
    label: "Rectangle",
    description: "Draw rectangle",
  },
  {
    id: "ellipse",
    icon: <Circle className="w-4 h-4" />,
    label: "Ellipse",
    description: "Draw ellipse and circle",
  },
  {
    id: "freedraw",
    icon: <Pencil className="w-4 h-4" />,
    label: "Free Draw",
    description: "Draw freehand lines",
  },
  {
    id: "arrow",
    icon: <ArrowRight className="w-4 h-4" />,
    label: "Arrow",
    description: "Draw arrow",
  },
  {
    id: "line",
    icon: <Minus className="w-4 h-4" />,
    label: "Line",
    description: "Draw line",
  },
  {
    id: "text",
    icon: <Type className="w-4 h-4" />,
    label: "Text",
    description: "Add text blocks",
  },
  {
    id: "eraser",
    icon: <Eraser className="w-4 h-4" />,
    label: "Eraser",
    description: "Erase shapes",
  },
];

const ToolBarShapes = () => {
  const { currentTool, selectTool } = useInfiniteCanvas();
  return (
    <div className="col-span-1 flex justify-center items-center">
      <div className="flex items-center backdrop-blur-xl backdrop-[url('#displacementFilter')] bg-white/8 border border-white/12 gap-2 rounded-full p-3 saturate-150">
        {tools.map((tool) => (
          <Button
            key={tool.id}
            size="lg"
            variant={"ghost"}
            onClick={() => selectTool(tool.id)}
            className={cn(
              "cursor-pointer rounded-full p-3",
              currentTool === tool.id
                ? "text-primary bg-white/12 border border-white/16"
                : "text-primary/50  hover:bg-white/6 border-transparent",
            )}
            title={`${tool.label} - ${tool.description}`}
          >
            {tool.icon}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default ToolBarShapes;
