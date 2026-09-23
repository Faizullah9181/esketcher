import { area, bbox, centroid, hatch, length, toPath, type Poly, type Pt } from "@/lib/geometry";
import type { Rng } from "@/lib/rng";

import type { Region, SketchArt, Stroke } from "./types";

interface RegionOptions {
  smooth?: boolean;
  focal?: boolean;
  /** draw the region's outline as line art (default true) */
  outline?: boolean;
  /** outline width */
  w?: number;
}

interface LineOptions {
  w?: number;
  o?: number;
  smooth?: boolean;
  closed?: boolean;
}

const SAMPLE_EVERY = 14;

/** Accumulates line art and paintable regions for one sketch. */
export class ArtBuilder {
  private readonly strokes: Stroke[] = [];
  private readonly regions: Region[] = [];
  private readonly kindCount = new Map<string, number>();
  private ink = 0;
  private readonly sample: Pt[] = [];

  constructor(
    readonly rng: Rng,
    /** 0..1: generators use it to decide how much detail to add */
    readonly complexity: number,
  ) {}

  region(kind: string, label: string, shape: Poly | Poly[], opts: RegionOptions = {}): Region {
    const polys = (isPolyList(shape) ? shape : [shape]).filter((p) => p.length > 2);
    const smooth = opts.smooth ?? false;
    const index = this.kindCount.get(kind) ?? 0;
    this.kindCount.set(kind, index + 1);
    const region: Region = {
      id: `${kind}-${index}`,
      kind,
      label,
      polys,
      d: polys.map((p) => toPath(p, true, smooth)).join(""),
      box: bbox(polys),
      area: polys.reduce((sum, p) => sum + area(p), 0),
      centroid: centroid(polys),
      focal: opts.focal ?? false,
    };
    this.regions.push(region);
    if (opts.outline ?? true) for (const p of polys) this.line(p, { closed: true, smooth, w: opts.w });
    return region;
  }

  line(pts: Poly, opts: LineOptions = {}): void {
    if (pts.length < 2) return;
    const closed = opts.closed ?? false;
    this.strokes.push({ d: toPath(pts, closed, opts.smooth ?? false), w: opts.w ?? 1.7, o: opts.o ?? 1 });
    this.ink += length(pts, closed);
    for (let i = 0; i < pts.length; i += Math.max(1, Math.floor(pts.length / SAMPLE_EVERY))) this.sample.push(pts[i]);
  }

  /** Secondary texture line: thinner and fainter. */
  detail(pts: Poly, opts: LineOptions = {}): void {
    this.line(pts, { w: 0.9, o: 0.55, ...opts });
  }

  /** Hatching inside a polygon; density follows complexity. */
  shade(poly: Poly, angle = -0.6, minComplexity = 0.45): void {
    if (this.complexity < minComplexity) return;
    const spacing = 16 - this.complexity * 9;
    for (const seg of hatch(poly, spacing, angle)) this.detail(seg, { o: 0.35, w: 0.7 });
  }

  /** True for a fraction of calls that grows with complexity. */
  detailed(threshold = 0.5): boolean {
    return this.complexity >= threshold;
  }

  build(): SketchArt {
    return { strokes: this.strokes, regions: this.regions, inkLength: this.ink, inkSample: this.sample };
  }
}

function isPolyList(shape: Poly | Poly[]): shape is Poly[] {
  return Array.isArray(shape[0]) && Array.isArray((shape as Poly[])[0][0]);
}
