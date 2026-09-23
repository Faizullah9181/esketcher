import { memo, useMemo } from "react";

import { blob, toPath } from "@/lib/geometry";
import { createRng, hashString } from "@/lib/rng";
import type { Material } from "@/types";

import { PaintLayer } from "./PaintLayer";

interface MaterialSwatchProps {
  material: Material;
  /** "dab" = organic paint sample (rail), "tile" = rounded square (library) */
  shape?: "dab" | "tile";
  /** distinguishes repeated swatches of the same material in one document */
  slot?: string | number;
  className?: string;
}

/** A small, static rendering of the actual material, not a colour chip. */
export const MaterialSwatch = memo(function MaterialSwatch({ material, shape = "dab", slot = 0, className }: MaterialSwatchProps) {
  const region = useMemo(() => {
    const pts =
      shape === "dab"
        ? blob(createRng(hashString(material.id)), 50, 50, 42, 11, 0.12)
        : [[6, 6], [94, 6], [94, 94], [6, 94]].map(([x, y]) => [x, y] as [number, number]);
    return { d: toPath(pts, true, shape === "dab"), box: { x: 4, y: 4, w: 92, h: 92 } };
  }, [material.id, shape]);
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <PaintLayer uid={`sw-${material.id}-${slot}`} material={material} region={region} origin={[40, 38]} animate={false} ambient="calm" />
      <path d={region.d} fill="none" stroke="#fff" strokeOpacity={0.16} strokeWidth={1.2} />
    </svg>
  );
});
