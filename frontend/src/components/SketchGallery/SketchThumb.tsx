import { memo, useMemo } from "react";

import { ART_H, ART_W, generateSketch } from "@/lib/sketchArt";
import type { SketchAsset } from "@/types";

/** Line-art preview straight from the generator: no image files. */
export const SketchThumb = memo(function SketchThumb({ sketch }: { sketch: SketchAsset }) {
  const art = useMemo(() => generateSketch(sketch), [sketch]);
  return (
    <svg viewBox={`0 0 ${ART_W} ${ART_H}`} className="block h-full w-full" aria-hidden>
      <rect width={ART_W} height={ART_H} fill="var(--es-paper)" />
      <g fill="none" stroke="var(--es-ink)" strokeLinecap="round" strokeLinejoin="round">
        {art.strokes.map((s, i) => (
          <path key={i} d={s.d} strokeWidth={s.w * 1.6} strokeOpacity={s.o} />
        ))}
      </g>
    </svg>
  );
});
