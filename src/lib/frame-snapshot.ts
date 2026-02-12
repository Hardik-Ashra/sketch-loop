import { FrameShape, Shape } from "@/redux/slices/shapes";

export const isShapeInsideFrame = (
  shape: Shape,
  frame: FrameShape,
): boolean => {
  const frameLeft = frame.x;
  const frameTop = frame.y;
  const frameRight = frame.x + frame.w;
  const frameBottom = frame.y + frame.h;

  switch (shape.type) {
    case "rect":
    case "ellipse":
    case "frame": {
      const centerX = shape.x + shape.w / 2;
      const centerY = shape.y + shape.h / 2;
      return (
        centerX >= frameLeft &&
        centerX <= frameRight &&
        centerY >= frameTop &&
        centerY <= frameBottom
      );
    }

    case "text":
      return (
        shape.x >= frameLeft &&
        shape.x <= frameRight &&
        shape.y >= frameTop &&
        shape.y <= frameBottom
      );

    case "freedraw":
      return shape.points.some(
        (p) =>
          p.x >= frameLeft &&
          p.x <= frameRight &&
          p.y >= frameTop &&
          p.y <= frameBottom,
      );

    case "line":
    case "arrow": {
      const startInside =
        shape.startX >= frameLeft &&
        shape.startX <= frameRight &&
        shape.startY >= frameTop &&
        shape.startY <= frameBottom;

      const endInside =
        shape.endX >= frameLeft &&
        shape.endX <= frameRight &&
        shape.endY >= frameTop &&
        shape.endY <= frameBottom;

      return startInside || endInside;
    }

    default:
      return false;
  }
};

export const getShapesInsideFrame = (
  shapes: Shape[],
  frame: FrameShape,
): Shape[] => {
  const shapesInFrame = shapes.filter(
    (shape) => shape.id !== frame.id && isShapeInsideFrame(shape, frame),
  );

  console.log(`Frame ${frame.frameNumber} capture:`, {
    totalShapes: shapes.length,
    captured: shapesInFrame.length,
    capturedTypes: shapesInFrame.map((s) => s.type),
  });

  return shapesInFrame;
};

const renderShapeOnCanvas = (
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  frameX: number,
  frameY: number,
) => {
  ctx.save();

  switch (shape.type) {
    case "rect":
    case "frame":
    case "ellipse": {
      const relativeX = shape.x - frameX;
      const relativeY = shape.y - frameY;

      ctx.strokeStyle =
        shape.stroke && shape.stroke !== "transparent"
          ? shape.stroke
          : "#ffffff";

      ctx.lineWidth = shape.strokeWidth || 2;

      if (shape.type === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(
          relativeX + shape.w / 2,
          relativeY + shape.h / 2,
          shape.w / 2,
          shape.h / 2,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      } else {
        const borderRadius = shape.type === "rect" ? 8 : 0;
        ctx.beginPath();
        ctx.roundRect(relativeX, relativeY, shape.w, shape.h, borderRadius);
        ctx.stroke();
      }
      break;
    }

    case "text": {
      ctx.fillStyle = shape.fill || "#ffffff";
      ctx.font = `${shape.fontSize}px ${shape.fontFamily || "Inter, sans-serif"
        }`;
      ctx.textBaseline = "top";
      ctx.fillText(shape.text, shape.x - frameX, shape.y - frameY);
      break;
    }

    case "freedraw":
      if (shape.points.length > 1) {
        ctx.strokeStyle = shape.stroke || "#ffffff";
        ctx.lineWidth = shape.strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(
          shape.points[0].x - frameX,
          shape.points[0].y - frameY,
        );

        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(
            shape.points[i].x - frameX,
            shape.points[i].y - frameY,
          );
        }

        ctx.stroke();
      }
      break;

    case "line":
    case "arrow": {
      ctx.strokeStyle = shape.stroke || "#ffffff";
      ctx.lineWidth = shape.strokeWidth || 2;

      const sx = shape.startX - frameX;
      const sy = shape.startY - frameY;
      const ex = shape.endX - frameX;
      const ey = shape.endY - frameY;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      if (shape.type === "arrow") {
        const headLength = 10;
        const angle = Math.atan2(ey - sy, ex - sx);

        ctx.fillStyle = shape.stroke || "#ffffff";
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(
          ex - headLength * Math.cos(angle - Math.PI / 6),
          ey - headLength * Math.sin(angle - Math.PI / 6),
        );
        ctx.lineTo(
          ex - headLength * Math.cos(angle + Math.PI / 6),
          ey - headLength * Math.sin(angle + Math.PI / 6),
        );
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
  }

  ctx.restore();
};

export const generateFrameSnapshot = async (
  frame: FrameShape,
  allShapes: Shape[],
): Promise<Blob> => {
  const shapesInFrame = getShapesInsideFrame(allShapes, frame);

  const canvas = document.createElement("canvas");
  canvas.width = frame.w;
  canvas.height = frame.h;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  shapesInFrame.forEach((shape) => {
    renderShapeOnCanvas(ctx, shape, frame.x, frame.y);
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create image blob"));
      },
      "image/png",
      1.0,
    );
  });
};





export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url)
}
