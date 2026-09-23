import { expect, it } from "vitest";

import { rect } from "@/lib/geometry";
import { createRng } from "@/lib/rng";

import { ArtBuilder } from "./builder";

it("numbers regions per kind and outlines them", () => {
  const b = new ArtBuilder(createRng(1), 0.8);
  b.region("petal", "a", rect(0, 0, 10, 10));
  b.region("petal", "b", [rect(20, 0, 10, 10), rect(40, 0, 10, 10)], { outline: false, focal: true });
  b.line([[0, 0]]);
  b.shade(rect(0, 0, 100, 100));
  const art = b.build();
  expect(art.regions.map((r) => r.id)).toEqual(["petal-0", "petal-1"]);
  expect(art.regions[1].area).toBe(200);
  expect(art.regions[1].focal).toBe(true);
  expect(art.strokes.length).toBeGreaterThan(1);
  expect(b.detailed(0.9)).toBe(false);
});

it("skips shading below its complexity threshold", () => {
  const b = new ArtBuilder(createRng(1), 0.2);
  b.shade(rect(0, 0, 100, 100));
  expect(b.build().strokes).toHaveLength(0);
});
