import type { Box, Poly, Pt } from "@/lib/geometry";

/** Art space every sketch is drawn in; boards scale it to their size. */
export const ART_W = 400;
export const ART_H = 500;

export interface Stroke {
  d: string;
  w: number;
  o: number;
}

export interface Region {
  id: string;
  kind: string;
  label: string;
  polys: Poly[];
  d: string;
  box: Box;
  area: number;
  centroid: Pt;
  focal: boolean;
}

export interface SketchArt {
  strokes: Stroke[];
  regions: Region[];
  /** total ink length, art units */
  inkLength: number;
  /** sparse sample of ink points for symmetry / composition analysis */
  inkSample: Pt[];
}
