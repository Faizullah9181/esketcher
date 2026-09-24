import { describe, expect, it } from "vitest";

import { generateSketch } from "@/lib/sketchArt";
import { MATERIALS, decision, material } from "@/test/fixtures";
import type { TargetFeatures } from "@/types";

import { colourFit, shortlist } from "./candidates";
import { distribute } from "./treatment";

const target: TargetFeatures = { kind: "iris", label: "iris", areaRatio: 0.05, complexity: 0.5, strokeDensity: 0.5, symmetry: 0.9, composition: "center-heavy" };

describe("shortlist", () => {
  it("returns a diverse, deterministic field", () => {
    const a = shortlist(MATERIALS, target, { count: 10, seed: 1 });
    expect(a).toHaveLength(10);
    expect(new Set(a).size).toBe(10);
    expect(shortlist(MATERIALS, target, { count: 10, seed: 1 })).toEqual(a);
    const perType = new Map<string, number>();
    for (const id of a) perType.set(id.split("-")[0], (perType.get(id.split("-")[0]) ?? 0) + 1);
    expect(Math.max(...perType.values())).toBeLessThanOrEqual(2);
  });

  it("biases towards behaviours that suit the target", () => {
    const hinted = new Set(["liquid", "holographic", "crystal"]);
    const counts = Array.from({ length: 30 }, (_, seed) => shortlist(MATERIALS, target, { count: 4, seed }).filter((id) => hinted.has(id.split("-")[0])).length);
    expect(counts.reduce((a, b) => a + b, 0) / counts.length).toBeGreaterThan(2);
  });

  it("honours include and exclude", () => {
    const out = shortlist(MATERIALS, target, { count: 5, seed: 3, include: ["lava-1", "lava-1"], exclude: ["liquid-0", "liquid-1"] });
    expect(out[0]).toBe("lava-1");
    expect(out).not.toContain("liquid-0");
    expect(shortlist(MATERIALS, target, { count: 3, seed: 3, include: ["ink-0"], exclude: ["ink-0"] })).not.toContain("ink-0");
  });

  it("works for kinds without hints", () => {
    expect(shortlist(MATERIALS, { ...target, kind: "zzz" }, { count: 6, seed: 9 })).toHaveLength(6);
  });
});

describe("colour-aware shortlist", () => {
  const warm = [0, 1, 2, 3, 4].map((i) => material({ id: `warm-${i}`, type: (["liquid", "spray", "ink", "grain", "crystal"] as const)[i], colorFamily: "fire", palette: ["#ff5a1f", "#ffb36b", "#6b1500"] }));
  const cool = [0, 1, 2, 3, 4].map((i) => material({ id: `cool-${i}`, type: (["liquid", "spray", "ink", "grain", "crystal"] as const)[i], colorFamily: "ocean", palette: ["#1f6bff", "#9db4ff", "#081a66"] }));
  const clash = [0, 1, 2].map((i) => material({ id: `lime-${i}`, type: (["pixel", "smoke", "lava"] as const)[i], colorFamily: "toxic", palette: ["#9dff00", "#eaff85", "#2a5200"] }));
  const pool = [...warm, ...cool, ...clash];
  const oceanPalette = { id: "ocean-ice", name: "Ocean & ice", families: ["ocean", "ice", "metal"], description: "" };

  it("fills the field from the board's palette, leaving one wildcard", () => {
    const field = shortlist(pool, target, { count: 6, seed: 4, palette: oceanPalette });
    const inPalette = field.filter((id) => id.startsWith("cool"));
    expect(inPalette.length).toBe(5);
    expect(field).toHaveLength(6);
  });

  it("prefers colours that harmonise with what's painted", () => {
    expect(colourFit(warm[0], [warm[1]])).toBe(1);
    expect(colourFit(clash[0], [warm[1]])).toBeLessThan(0);
    expect(colourFit(warm[0], [])).toBe(0);
    const field = shortlist([...warm, ...clash], { ...target, kind: "zzz" }, { count: 4, seed: 2, painted: [warm[0]] });
    expect(field.filter((id) => id.startsWith("warm")).length).toBeGreaterThanOrEqual(3);
  });

  it("keeps big backgrounds calm and focal parts luminous", () => {
    const loud = material({ id: "loud", type: "smoke", intensity: 0.95, luminous: false, colorFamily: "x" });
    const calm = material({ id: "calm", type: "smoke", intensity: 0.4, luminous: false, colorFamily: "x" });
    const sky = shortlist([loud, calm], { ...target, kind: "sky", areaRatio: 0.6 }, { count: 1, seed: 1 });
    expect(sky).toEqual(["calm"]);
    const glow = material({ id: "glow", type: "smoke", luminous: true, intensity: 0.7, colorFamily: "x" });
    const dull = material({ id: "dull", type: "smoke", luminous: false, intensity: 0.7, colorFamily: "x" });
    expect(shortlist([dull, glow], { ...target, kind: "iris" }, { count: 1, seed: 1 })).toEqual(["glow"]);
  });

  it("tops up from outside the palette when the palette runs dry", () => {
    const field = shortlist(pool, target, { count: 12, seed: 9, palette: { ...oceanPalette, families: ["none"] } });
    expect(field).toHaveLength(12);
  });
});

describe("distribute", () => {
  const regions = generateSketch({ category: "flowers", variant: 0, seed: 1, complexity: 0.5 }).regions;

  it("floods every region with the winner by default", () => {
    const out = distribute(decision(), regions);
    expect(Object.keys(out)).toHaveLength(regions.length);
    expect(new Set(Object.values(out))).toEqual(new Set(["liquid-0"]));
  });

  it("paints only focal regions for focal-accent", () => {
    const out = distribute(decision({ treatment: { mode: "focal-accent", probabilities: {}, confidence: 0.8 } }), regions);
    expect(Object.keys(out).every((id) => regions.find((r) => r.id === id)?.focal)).toBe(true);
    const noFocal = regions.map((r) => ({ ...r, focal: false }));
    expect(Object.keys(distribute(decision({ treatment: { mode: "focal-accent", probabilities: {}, confidence: 0.8 } }), noFocal))).toHaveLength(1);
  });

  it("spreads the top materials by kind", () => {
    const duo = distribute(decision({ treatment: { mode: "duotone", probabilities: {}, confidence: 0.5 } }), regions);
    expect(new Set(Object.values(duo)).size).toBe(2);
    const mix = distribute(decision({ treatment: { mode: "spectrum-mix", probabilities: {}, confidence: 0.5 } }), regions);
    expect(new Set(Object.values(mix)).size).toBeGreaterThanOrEqual(2);
  });

  it("handles an empty sketch", () => {
    expect(distribute(decision(), [])).toEqual({});
  });
});
