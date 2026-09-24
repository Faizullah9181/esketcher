import { memo, useMemo } from "react";

import { SketchBoard } from "@/lib/canvas/SketchBoard";
import { strokePath } from "@/lib/desk/strokes";
import type { FrameShape, Shape, StrokeShape } from "@/lib/desk/types";

const place = (s: Shape) => ({
  width: s.w,
  height: s.h,
  transform: `translate(${s.x}px, ${s.y}px) rotate(${s.rotation}rad)`,
});

const Stroke = memo(function Stroke({ shape }: { shape: StrokeShape }) {
  const d = useMemo(() => strokePath(shape.points, shape.size, shape.brush), [shape.points, shape.size, shape.brush]);
  return (
    <svg width={shape.w} height={shape.h} overflow="visible" className="block">
      <path d={d} fill={shape.color} opacity={shape.brush ? 0.45 : 1} style={shape.brush ? { mixBlendMode: "screen" } : undefined} />
    </svg>
  );
});

function Frame({ shape }: { shape: FrameShape }) {
  return (
    <div className="es-frame">
      <div className="es-frame__title">{shape.title}</div>
    </div>
  );
}

export const ShapeView = memo(function ShapeView({ shape, selected, erasing }: { shape: Shape; selected: boolean; erasing: boolean }) {
  const classes = ["es-shape", `es-shape--${shape.type}`, selected && shape.type !== "board" && "es-shape--selected", erasing && "es-shape--erasing"].filter(Boolean).join(" ");
  return (
    <div className={classes} style={place(shape)} data-shape={shape.id}>
      {shape.type === "board" ? <SketchBoard board={shape} /> : shape.type === "stroke" ? <Stroke shape={shape} /> : <Frame shape={shape} />}
    </div>
  );
});
