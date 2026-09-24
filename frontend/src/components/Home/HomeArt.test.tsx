import { act, render } from "@testing-library/react";
import { motionValue } from "motion/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { initialStudio, useStudio } from "@/state/studio";
import { MATERIALS, sketch } from "@/test/fixtures";

import { BURST_MS, FLIGHT_MS, MaterialGrid, PAINT_EVERY_MS, START_DELAY_MS, Stage, type Landing } from "./HomeArt";

const CATEGORIES = ["eyes", "flowers", "mechanical", "insects", "planets"] as const;

const originalMatchMedia = window.matchMedia;
let reduced = true;
const mediaQuery = (query: string) =>
  ({ matches: query.includes("reduced-motion") && reduced, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList;

const tilt = () => ({ rx: motionValue(0), ry: motionValue(0) });

beforeEach(() => {
  reduced = true;
  window.matchMedia = mediaQuery;
  vi.useFakeTimers();
  useStudio.setState(initialStudio);
  useStudio.getState().setCatalog(MATERIALS, CATEGORIES.map((category, i) => sketch({ id: `sk-00${i}`, category, title: category })));
});
afterEach(() => {
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
});

it("paints its preview sketches over time and starts over when full", () => {
  const landings: Landing[] = [];
  const { container } = render(<Stage tilt={tilt()} onLanding={(l) => landings.push(l)} />);
  expect(container.querySelectorAll(".es-board")).toHaveLength(5);
  expect(container.querySelectorAll(".es-stream-chip").length).toBeGreaterThan(0);
  act(() => vi.advanceTimersByTime(START_DELAY_MS + PAINT_EVERY_MS * 400));
  expect(container.querySelectorAll("clipPath[id$='-clip']").length).toBeGreaterThan(20);
  // reduced motion: paint lands directly, nothing flies
  expect(container.querySelector(".es-flight")).toBeNull();
  expect(landings.length).toBeGreaterThan(100);
  expect(landings[0]).toMatchObject({ sketch: expect.any(String), region: expect.any(String), material: expect.any(String) });
});

it("flies a material from the stream to the region, then bursts", () => {
  reduced = false;
  const onLanding = vi.fn();
  const { container } = render(<Stage tilt={tilt()} onLanding={onLanding} />);
  act(() => vi.advanceTimersByTime(START_DELAY_MS + 5));
  expect(container.querySelectorAll(".es-flight")).toHaveLength(1);
  expect(container.querySelector(".es-burst")).toBeNull();
  expect(onLanding).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(FLIGHT_MS));
  expect(container.querySelector(".es-flight")).toBeNull();
  expect(container.querySelectorAll(".es-burst")).toHaveLength(1);
  expect(onLanding).toHaveBeenCalledTimes(1);
  expect(container.querySelectorAll("clipPath[id$='-clip']").length).toBeGreaterThan(0);
  act(() => vi.advanceTimersByTime(BURST_MS));
  expect(container.querySelector(".es-burst")).toBeNull();
});

it("stays quiet without a catalog and stops its loop on unmount", () => {
  useStudio.setState(initialStudio);
  const onLanding = vi.fn();
  const { container, unmount } = render(<Stage tilt={tilt()} onLanding={onLanding} />);
  expect(container.querySelectorAll(".es-board")).toHaveLength(0);
  act(() => vi.advanceTimersByTime(START_DELAY_MS + PAINT_EVERY_MS * 3));
  expect(onLanding).not.toHaveBeenCalled();
  unmount();
});

it("shows one of every behaviour first in the grid", () => {
  const { container } = render(<MaterialGrid />);
  const cards = container.querySelectorAll(".es-swatch-card");
  expect(cards.length).toBe(Math.min(24, MATERIALS.length));
  const behaviours = new Set(MATERIALS.map((m) => m.type));
  const firstNames = [...cards].slice(0, behaviours.size).map((c) => c.querySelector(".es-mono")?.textContent);
  expect(new Set(firstNames).size).toBe(behaviours.size);
});
