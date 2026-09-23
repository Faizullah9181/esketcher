import { describe, expect, it } from "vitest";

import { createRng, hashString } from "./rng";

describe("rng", () => {
  it("is deterministic per seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(createRng(1)()).not.toBe(createRng(2)());
  });

  it("stays in range", () => {
    const r = createRng(7);
    for (let i = 0; i < 500; i++) {
      const v = r.range(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
      const n = r.int(1, 3);
      expect([1, 2, 3]).toContain(n);
    }
    expect(["a", "b"]).toContain(r.pick(["a", "b"]));
    expect(typeof r.chance(0.5)).toBe("boolean");
    expect(Math.abs(r.gauss())).toBeLessThan(10);
  });

  it("handles a zero seed", () => {
    expect(createRng(0)()).toBeGreaterThanOrEqual(0);
  });

  it("hashes strings stably", () => {
    expect(hashString("jev")).toBe(hashString("jev"));
    expect(hashString("jev")).not.toBe(hashString("vej"));
  });
});
