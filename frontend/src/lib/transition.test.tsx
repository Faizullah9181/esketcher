import { act, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { RouteSplash } from "@/components/common/RouteSplash";

import { COVER_MS, REVEAL_MS, openStudio, resetTransition, useSplash } from "./transition";

const originalMatchMedia = window.matchMedia;
let reduced = false;

beforeEach(() => {
  reduced = false;
  window.matchMedia = ((query: string) => ({ matches: query.includes("reduced-motion") && reduced, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
  vi.useFakeTimers();
});
afterEach(() => {
  resetTransition();
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
  window.history.replaceState({}, "", "/");
});

it("covers from the click, navigates, then reveals", () => {
  const { result } = renderHook(() => useSplash());
  const { container } = render(<RouteSplash />);
  act(() => openStudio({ x: 40, y: 30 }));
  expect(result.current).toEqual({ phase: "cover", x: 40, y: 30 });
  expect(container.querySelectorAll(".es-splash")).toHaveLength(2);
  expect(window.location.pathname).toBe("/");
  act(() => openStudio({ x: 1, y: 1 })); // a second click mid-wipe changes nothing
  expect(result.current).toEqual({ phase: "cover", x: 40, y: 30 });
  act(() => vi.advanceTimersByTime(COVER_MS));
  expect(window.location.pathname).toBe("/studio");
  expect(result.current?.phase).toBe("reveal");
  act(() => vi.advanceTimersByTime(REVEAL_MS));
  expect(result.current).toBeNull();
});

it("skips the wipe without a point or with reduced motion", () => {
  const { result } = renderHook(() => useSplash());
  act(() => openStudio());
  expect(window.location.pathname).toBe("/studio");
  expect(result.current).toBeNull();
  window.history.replaceState({}, "", "/");
  reduced = true;
  act(() => openStudio({ x: 5, y: 5 }));
  expect(window.location.pathname).toBe("/studio");
  expect(result.current).toBeNull();
});
