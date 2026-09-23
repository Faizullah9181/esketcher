import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MATERIALS, material } from "@/test/fixtures";

import { MaterialSwatch } from "./MaterialSwatch";
import { noiseTile } from "./noise";
import { PaintDefs } from "./PaintDefs";
import { PaintLayer } from "./PaintLayer";
import {
  BEHAVIOR_MOTION,
  blobs,
  brushStrokes,
  facets,
  inkBranches,
  longestReveal,
  particles,
  pixelCells,
  reachFrom,
  revealDuration,
  spectrum,
  wobble,
} from "./recipes";

const box = { x: 10, y: 10, w: 200, h: 160 };

describe("recipes", () => {
  it("times reveals by behaviour and viscosity", () => {
    expect(revealDuration({ type: "lava", viscosity: 1 })).toBeGreaterThan(revealDuration({ type: "chrome", viscosity: 0 }));
    expect(longestReveal([undefined, { type: "smoke", viscosity: 0 }])).toBeGreaterThan(1500);
    expect(longestReveal([])).toBe(1000);
    expect(Object.keys(BEHAVIOR_MOTION)).toHaveLength(13);
  });

  it("generates deterministic, bounded procedural parts", () => {
    expect(particles(box, [0, 0], 1, 50)).toEqual(particles(box, [0, 0], 1, 50));
    const p = particles(box, [0, 0], 1, 50)[0];
    expect(p.dx).toBeCloseTo(-p.x);
    expect(pixelCells({ x: 0, y: 0, w: 4000, h: 4000 }, [0, 0], 1, 0.5, 100).length).toBeLessThanOrEqual(121);
    expect(facets(box, [0, 0], 1, 20)).toHaveLength(20);
    expect(brushStrokes(box, 1, 0.5).length).toBeGreaterThanOrEqual(5);
    expect(inkBranches(box, [50, 50], 1, 4)).toHaveLength(4);
    expect(blobs(box, 1, 3)).toHaveLength(3);
    expect(wobble([0, 0], 10, 1)).toMatch(/^M.*Z$/);
    expect(reachFrom([10, 10], box)).toBeGreaterThan(Math.hypot(200, 160));
    expect(spectrum(["#ff0000", "#00ff00", "#0000ff"])).toHaveLength(7);
  });
});

describe("PaintLayer", () => {
  const region = { d: "M10 10L210 10L210 170L10 170Z", box };

  it.each(MATERIALS.filter((m) => m.id.endsWith("-0")).map((m) => [m.type, m] as const))("renders %s animated and settled", (_type, m) => {
    for (const animate of [true, false]) {
      const { container, unmount } = render(
        <svg>
          <PaintLayer uid={`t-${m.id}-${animate}`} material={m} region={region} origin={[100, 90]} animate={animate} ambient={animate ? "alive" : "calm"} />
        </svg>,
      );
      expect(container.querySelector(`clipPath#t-${m.id}-${animate}-clip`)).not.toBeNull();
      expect(container.querySelectorAll("g").length).toBeGreaterThan(0);
      unmount();
    }
  });

  it("adds an inner glow for luminous materials and an exit class", () => {
    const { container } = render(
      <svg>
        <PaintLayer uid="glow" material={material({ luminous: true })} region={region} origin={[0, 0]} animate={false} ambient="calm" exiting />
      </svg>,
    );
    expect(container.querySelector(".paint-exit")).not.toBeNull();
    expect(container.querySelector("path[filter='url(#es-blur-sm)']")).not.toBeNull();
  });
});

describe("swatches and defs", () => {
  it("renders dab and tile swatches", () => {
    const { container } = render(
      <>
        <MaterialSwatch material={material()} />
        <MaterialSwatch material={material({ id: "x" })} shape="tile" slot="lib" />
      </>,
    );
    expect(container.querySelectorAll("svg")).toHaveLength(2);
  });

  it("renders shared filters even without canvas support", () => {
    expect(typeof noiseTile()).toBe("string");
    const { container } = render(<PaintDefs />);
    expect(container.querySelector("#es-blur-lg")).not.toBeNull();
    expect(container.querySelector("#es-tooth")).not.toBeNull();
  });
});
