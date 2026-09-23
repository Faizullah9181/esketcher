import { describe, expect, it } from "vitest";

import {
  arc,
  area,
  bbox,
  blob,
  capsule,
  centroid,
  circle,
  clipToBox,
  curve,
  ellipse,
  ellipseBand,
  gear,
  hatch,
  lathe,
  length,
  mirrorX,
  petal,
  pointInPoly,
  rect,
  regular,
  ribbon,
  sector,
  star,
  toPath,
  transform,
  wave,
} from "./geometry";
import { createRng } from "./rng";

describe("geometry", () => {
  it("measures a rectangle", () => {
    const r = rect(10, 20, 30, 40);
    expect(area(r)).toBe(1200);
    expect(bbox([r])).toEqual({ x: 10, y: 20, w: 30, h: 40 });
    expect(centroid([r])).toEqual([25, 40]);
    expect(length(r, true)).toBe(140);
    expect(length(r)).toBe(100);
  });

  it("handles empty input", () => {
    expect(bbox([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(centroid([])).toEqual([0, 0]);
    expect(toPath([[1, 1]])).toBe("");
  });

  it("builds closed shapes of the right size", () => {
    expect(ellipse(0, 0, 10, 5, 8)).toHaveLength(8);
    expect(area(circle(0, 0, 10, 200))).toBeCloseTo(Math.PI * 100, 0);
    expect(star(0, 0, 10, 4, 5)).toHaveLength(10);
    expect(regular(0, 0, 10, 6)).toHaveLength(6);
    expect(gear(0, 0, 20, 8, 4)).toHaveLength(40);
    expect(bbox([capsule([0, 0], [100, 0], 10)]).w).toBeCloseTo(120, 0);
    expect(arc(0, 0, 10, 10, 0, Math.PI, 4)).toHaveLength(5);
    expect(sector(0, 0, 5, 10, 0, 1, 4)).toHaveLength(10);
    expect(ellipseBand(0, 0, [10, 4], [8, 3], 0, Math.PI, 0, 6)).toHaveLength(14);
    expect(wave(0, 100, 50, 5, 2, 0, 10)).toHaveLength(11);
  });

  it("builds petals, lathes, ribbons and curves", () => {
    const p = petal(0, 0, 100, 20, 0);
    expect(bbox([p]).w).toBeCloseTo(100, 0);
    const vase = lathe(100, 0, 100, [10, 30, 20]);
    expect(bbox([vase])).toMatchObject({ x: 70, w: 60, h: 100 });
    expect(ribbon([[0, 0], [100, 0]], 10)).toHaveLength(4);
    const c = curve([[0, 0], [50, 100], [100, 0]], 10);
    expect(c[0]).toEqual([0, 0]);
    expect(c[10]).toEqual([100, 0]);
    expect(curve([[0, 0], [1, 1]])).toEqual([[0, 0], [1, 1]]);
  });

  it("blobs stay near their radius", () => {
    const b = blob(createRng(1), 0, 0, 50, 12, 0.2);
    for (const [x, y] of b) expect(Math.hypot(x, y)).toBeLessThanOrEqual(60 + 1e-9);
  });

  it("transforms and mirrors", () => {
    expect(transform([[1, 0]], { rot: Math.PI / 2, tx: 5 })[0][0]).toBeCloseTo(5);
    expect(transform([[1, 2]], { sx: 2 })[0]).toEqual([2, 4]);
    expect(mirrorX([[0, 0], [10, 5]], 20)).toEqual([[30, 5], [40, 0]]);
  });

  it("tests points against polygons", () => {
    const r = rect(0, 0, 10, 10);
    expect(pointInPoly([5, 5], r)).toBe(true);
    expect(pointInPoly([15, 5], r)).toBe(false);
  });

  it("hatches inside a polygon only", () => {
    const lines = hatch(rect(0, 0, 100, 100), 10, 0);
    expect(lines).toHaveLength(10);
    for (const [[x0], [x1]] of lines) {
      expect(x0).toBeGreaterThanOrEqual(-1e-6);
      expect(x1).toBeLessThanOrEqual(100 + 1e-6);
    }
  });

  it("clips polygons to a box", () => {
    const clipped = clipToBox(rect(-10, -10, 40, 40), { x: 0, y: 0, w: 20, h: 20 });
    expect(bbox([clipped])).toEqual({ x: 0, y: 0, w: 20, h: 20 });
    expect(clipToBox(rect(100, 100, 5, 5), { x: 0, y: 0, w: 20, h: 20 })).toEqual([]);
  });

  it("writes straight and smooth SVG paths", () => {
    expect(toPath([[0, 0], [10, 0], [10, 10]])).toBe("M0 0L10 0L10 10Z");
    expect(toPath([[0, 0], [10, 0]], false)).toBe("M0 0L10 0");
    const smooth = toPath([[0, 0], [10, 0], [10, 10], [0, 10]], true, true);
    expect(smooth.startsWith("M0 0C")).toBe(true);
    expect(smooth.endsWith("Z")).toBe(true);
    expect(toPath([[0, 0], [10, 0], [10, 10]], false, true)).not.toContain("Z");
  });
});
