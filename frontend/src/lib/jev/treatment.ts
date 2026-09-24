import type { Region } from "@/lib/sketchArt";
import type { Decision } from "@/types";

/** Turn a whole-sketch decision into region → material assignments. */
export function distribute(decision: Decision, regions: Region[]): Record<string, string> {
  const ranked = decision.ranking.map((r) => r.materialId);
  const top = decision.selectedMaterial;
  const mode = decision.treatment?.mode ?? "full-flood";
  const out: Record<string, string> = {};
  if (!regions.length) return out;

  if (mode === "focal-accent") {
    const focal = regions.filter((r) => r.focal);
    for (const region of focal.length ? focal : [largest(regions)]) out[region.id] = top;
    return out;
  }
  const palette = mode === "duotone" ? ranked.slice(0, 2) : mode === "spectrum-mix" ? ranked.slice(0, 4) : [top];
  // group by kind so same-kind regions (all petals, all windows) share a material
  const kinds = [...new Set(regions.map((r) => r.kind))];
  for (const region of regions) out[region.id] = palette[kinds.indexOf(region.kind) % palette.length];
  return out;
}

function largest(regions: Region[]): Region {
  return regions.reduce((a, b) => (b.area > a.area ? b : a));
}
