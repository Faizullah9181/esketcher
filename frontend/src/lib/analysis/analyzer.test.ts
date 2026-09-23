import { describe, expect, it } from "vitest";

import { generateSketch } from "@/lib/sketchArt";
import { material } from "@/test/fixtures";
import type { Pt } from "@/lib/geometry";

import { analyzeTarget, compositionOf, symmetryOf } from "./analyzer";

const art = generateSketch({ category: "eyes", variant: 0, seed: 1, complexity: 0.6 });
const materials = new Map([["neon-liquid", material()]]);

describe("analyzer", () => {
  it("measures the whole board", () => {
    const f = analyzeTarget(art, null, 0.6, { "iris-0": { m: "neon-liquid", t: 0 } }, materials);
    expect(f.kind).toBe("board");
    expect(f.areaRatio).toBe(1);
    expect(f.dominantColor).toBe("#ff2bd6");
    for (const v of [f.complexity, f.strokeDensity, f.symmetry]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("measures a region from its real geometry", () => {
    const iris = art.regions.find((r) => r.kind === "iris")!;
    const f = analyzeTarget(art, iris, 0.6, {}, materials);
    expect(f.kind).toBe("iris");
    expect(f.label).toBe("iris");
    expect(f.areaRatio).toBeGreaterThan(0);
    expect(f.areaRatio).toBeLessThan(0.1);
    expect(f.symmetry).toBeGreaterThan(0.8);
    expect(f.dominantColor).toBeNull();
    const painted = analyzeTarget(art, iris, 0.6, { [iris.id]: { m: "neon-liquid", t: 0 } }, materials);
    expect(painted.dominantColor).toBe("#ff2bd6");
  });

  it("scores symmetry", () => {
    const mirrored: Pt[] = [[10, 10], [90, 10], [20, 50], [80, 50]];
    expect(symmetryOf(mirrored, 50, 4)).toBe(1);
    expect(symmetryOf([[10, 10], [30, 50], [11, 80], [12, 20]], 50, 4)).toBe(0);
    expect(symmetryOf([[1, 1]], 50, 4)).toBe(0.5);
  });

  it("classifies composition", () => {
    const box = { x: 0, y: 0, w: 100, h: 100 };
    expect(compositionOf([], box)).toBe("balanced");
    expect(compositionOf([[50, 10], [52, 12]], box)).toBe("top-heavy");
    expect(compositionOf([[50, 90], [52, 92]], box)).toBe("bottom-heavy");
    expect(compositionOf([[10, 50], [12, 52]], box)).toBe("left-heavy");
    expect(compositionOf([[90, 50], [92, 52]], box)).toBe("right-heavy");
    expect(compositionOf([[50, 50], [51, 51]], box)).toBe("center-heavy");
    expect(compositionOf([[0, 0], [100, 100], [0, 100], [100, 0]], box)).toBe("scattered");
    expect(compositionOf([[20, 50], [80, 50], [50, 20], [50, 80]], box)).toBe("balanced");
  });
});
