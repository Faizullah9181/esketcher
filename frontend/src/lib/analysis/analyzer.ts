import { pointInPoly, type Pt } from "@/lib/geometry";
import { ART_H, ART_W, type Region, type SketchArt } from "@/lib/sketchArt";
import type { Composition, Material, Paint, TargetFeatures } from "@/types";

const ART_AREA = ART_W * ART_H;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Share of mirrored ink points that land near real ink: 1 = perfectly mirrored.
 * Spatial hash keeps it linear in the number of points. */
export function symmetryOf(points: Pt[], axisX: number, tolerance: number): number {
  if (points.length < 4) return 0.5;
  const cell = (v: number) => Math.floor(v / tolerance);
  const grid = new Set(points.map(([x, y]) => `${cell(x)}:${cell(y)}`));
  let hits = 0;
  for (const [x, y] of points) {
    const mx = cell(2 * axisX - x);
    const my = cell(y);
    search: for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        if (grid.has(`${mx + dx}:${my + dy}`)) {
          hits++;
          break search;
        }
  }
  return hits / points.length;
}

export function compositionOf(points: Pt[], box = { x: 0, y: 0, w: ART_W, h: ART_H }): Composition {
  if (!points.length) return "balanced";
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  const dx = (sx / points.length - cx) / box.w;
  const dy = (sy / points.length - cy) / box.h;
  const spread =
    points.reduce((acc, [x, y]) => acc + Math.hypot((x - cx) / box.w, (y - cy) / box.h), 0) / points.length;
  if (Math.abs(dx) > 0.08 || Math.abs(dy) > 0.08) {
    if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? "top-heavy" : "bottom-heavy";
    return dx < 0 ? "left-heavy" : "right-heavy";
  }
  if (spread > 0.42) return "scattered";
  if (spread < 0.24) return "center-heavy";
  return "balanced";
}

function inkInside(art: SketchArt, region: Region): Pt[] {
  return art.inkSample.filter((p) => region.polys.some((poly) => pointInPoly(p, poly)));
}

/**
 * Measure a selection the way Jev will read it. `region` null means the whole board.
 * Everything here is derived from the actual drawing, never invented.
 */
export function analyzeTarget(
  art: SketchArt,
  region: Region | null,
  sketchComplexity: number,
  paints: Record<string, Paint>,
  materials: Map<string, Material>,
): TargetFeatures {
  const tolerance = 18;
  if (!region) {
    const painted = Object.values(paints)
      .map((p) => materials.get(p.m))
      .filter((m): m is Material => Boolean(m));
    const density = clamp01(art.inkLength / 9000);
    return {
      kind: "board",
      label: "whole sketch",
      areaRatio: 1,
      complexity: round(clamp01(sketchComplexity * 0.6 + (art.regions.length / 30) * 0.4)),
      strokeDensity: round(density),
      symmetry: round(symmetryOf(art.inkSample, ART_W / 2, tolerance)),
      composition: compositionOf(art.inkSample),
      dominantColor: painted[0]?.palette[0] ?? null,
    };
  }
  const inside = inkInside(art, region);
  // ink per unit area, relative to the sketch as a whole: 0.5 = as busy as average
  const sketchDensity = art.inkSample.length / ART_AREA || 1e-6;
  const ratio = inside.length / Math.max(region.area, 1) / sketchDensity;
  const paint = paints[region.id];
  return {
    kind: region.kind,
    label: region.label.slice(0, 48),
    areaRatio: round(clamp01(region.area / ART_AREA)),
    complexity: round(clamp01(sketchComplexity * 0.5 + Math.min(region.polys.length, 12) / 24 + inside.length / 80)),
    strokeDensity: round(ratio / (1 + ratio)),
    symmetry: round(symmetryOf(region.polys.flat(), region.box.x + region.box.w / 2, Math.max(4, region.box.w / 14))),
    composition: compositionOf(region.polys.flat()),
    dominantColor: paint ? (materials.get(paint.m)?.palette[0] ?? null) : null,
  };
}
