import { describe, expect, it } from "vitest";

import type { SketchCategory } from "@/types";

import { ART_H, ART_W, GENERATORS, generateSketch } from "./index";

const CATEGORIES = Object.keys(GENERATORS) as SketchCategory[];

describe("procedural sketches", () => {
  it("covers every catalogue category", () => {
    expect(CATEGORIES).toHaveLength(21);
  });

  it.each(CATEGORIES)("%s: every variant draws paintable line art", (category) => {
    for (let variant = 0; variant < 5; variant++) {
      for (const complexity of [0.3, 0.9]) {
        const art = generateSketch({ category, variant, seed: 1000 + variant, complexity });
        expect(art.regions.length).toBeGreaterThan(0);
        expect(art.strokes.length).toBeGreaterThan(0);
        expect(art.inkLength).toBeGreaterThan(0);
        const ids = art.regions.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const region of art.regions) {
          expect(region.d.startsWith("M")).toBe(true);
          expect(region.d).not.toContain("NaN");
          expect(Number.isFinite(region.area)).toBe(true);
          expect(region.box.x).toBeGreaterThan(-ART_W);
          expect(region.box.y + region.box.h).toBeLessThan(ART_H * 2);
        }
        for (const stroke of art.strokes) expect(stroke.d).not.toContain("NaN");
      }
    }
  });

  it("is deterministic and memoised", () => {
    const recipe = { category: "flowers" as const, variant: 2, seed: 99, complexity: 0.5 };
    const a = generateSketch(recipe);
    expect(generateSketch({ ...recipe })).toBe(a);
    const fresh = generateSketch({ ...recipe, seed: 100 });
    expect(fresh).not.toBe(a);
  });

  it("adds detail with complexity", () => {
    const simple = generateSketch({ category: "eyes", variant: 0, seed: 5, complexity: 0.3 });
    const busy = generateSketch({ category: "eyes", variant: 0, seed: 5, complexity: 0.95 });
    expect(busy.strokes.length).toBeGreaterThan(simple.strokes.length);
  });

  it("falls back for unknown categories", () => {
    const art = generateSketch({ category: "nope" as SketchCategory, variant: 0, seed: 1, complexity: 0.5 });
    expect(art.regions.length).toBeGreaterThan(0);
  });

  it("marks focal regions somewhere in most categories", () => {
    const withFocal = CATEGORIES.filter((category) => generateSketch({ category, variant: 0, seed: 3, complexity: 0.6 }).regions.some((r) => r.focal));
    expect(withFocal.length).toBeGreaterThanOrEqual(18);
  });
});
