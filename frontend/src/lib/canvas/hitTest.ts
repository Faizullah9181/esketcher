import { pointInPoly, type Pt } from "@/lib/geometry";
import type { Region, SketchArt } from "@/lib/sketchArt";

/** Topmost region under an art-space point (regions later in the list draw on top). */
export function regionAtPoint(art: SketchArt, point: Pt): Region | null {
  for (let i = art.regions.length - 1; i >= 0; i--) {
    const region = art.regions[i];
    const { x, y, w, h } = region.box;
    if (point[0] < x || point[1] < y || point[0] > x + w || point[1] > y + h) continue;
    if (region.polys.some((poly) => pointInPoly(point, poly))) return region;
  }
  return null;
}
