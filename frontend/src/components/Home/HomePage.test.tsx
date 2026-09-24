import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { COVER_MS, resetTransition } from "@/lib/transition";
import { initialStudio, useStudio } from "@/state/studio";
import { MATERIALS, sketch } from "@/test/fixtures";

import { PAINT_EVERY_MS, START_DELAY_MS } from "./HomeArt";
import { HomePage } from "./HomePage";

const CATEGORIES = ["eyes", "flowers", "mechanical", "insects", "planets"] as const;

const originalMatchMedia = window.matchMedia;
let reduced = true;
const mediaQuery = (query: string) =>
  ({ matches: query.includes("reduced-motion") && reduced, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList;

const catalog = () => useStudio.getState().setCatalog(MATERIALS, CATEGORIES.map((category, i) => sketch({ id: `sk-00${i}`, category, title: category })));

beforeEach(() => {
  reduced = true;
  window.matchMedia = mediaQuery;
  useStudio.setState(initialStudio);
  catalog();
});
afterEach(() => {
  resetTransition();
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
  window.history.replaceState({}, "", "/");
});

it("introduces the studio with real catalogue numbers", () => {
  useStudio.getState().setHealth({ status: "ok", version: "1", jev: { mode: "mock", model: "jev-mock", online: true, latencyMs: 0, availableModels: [], error: null } });
  render(<HomePage />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Jev decides.");
  expect(screen.getByText(String(MATERIALS.length))).toBeInTheDocument();
  expect(screen.getByText("13")).toBeInTheDocument();
  expect(screen.getAllByText("jev online · mock").length).toBeGreaterThan(0);
  expect(screen.getByText("How it works", { selector: "a.es-btn" })).toHaveAttribute("href", "#how");
  expect(screen.getByRole("link", { name: "Gallery" })).toHaveAttribute("href", "/gallery");
  // heading order: the section labels are the h2s the h3 steps sit under
  expect(screen.getByRole("heading", { level: 2, name: "how it works" })).toBeInTheDocument();
});

it("renders the hero before the catalog or the art chunk arrive, then fills in", async () => {
  useStudio.setState(initialStudio);
  const { container } = render(<HomePage />);
  expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  expect(container.querySelector(".es-stage")).not.toBeNull(); // the placeholder holds the footprint
  expect(container.querySelectorAll(".es-board")).toHaveLength(0);
  expect(screen.getByText("105")).toBeInTheDocument();
  act(catalog);
  await waitFor(() => expect(container.querySelectorAll(".es-board")).toHaveLength(5));
  await waitFor(() => expect(container.querySelectorAll(".es-swatch-card").length).toBeGreaterThan(0));
});

it("lists the stage's landings in the ticker", async () => {
  // fake timers first, so the stage's loop is scheduled on the clock we control
  vi.useFakeTimers();
  const { container } = render(<HomePage />);
  await act(async () => {
    await import("./HomeArt"); // the lazy chunk; React re-renders the Suspense boundary once it settles
  });
  expect(container.querySelectorAll(".es-board")).toHaveLength(5);
  act(() => vi.advanceTimersByTime(START_DELAY_MS + PAINT_EVERY_MS * 4));
  expect(container.querySelectorAll(".es-ticker li").length).toBeGreaterThan(0);
  expect(container.querySelectorAll(".es-ticker li").length).toBeLessThanOrEqual(3);
});

it("follows the mouse across the hero and rests when it leaves", () => {
  reduced = false;
  render(<HomePage />);
  const hero = document.querySelector<HTMLElement>(".es-hero")!;
  hero.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500, x: 0, y: 0, toJSON: () => ({}) });
  fireEvent.pointerMove(hero, { clientX: 250, clientY: 100, pointerType: "mouse" });
  expect(hero.style.getPropertyValue("--mx")).toBe("25%");
  expect(hero.style.getPropertyValue("--my")).toBe("20%");
  fireEvent.pointerMove(hero, { clientX: 900, clientY: 100, pointerType: "touch" });
  expect(hero.style.getPropertyValue("--mx")).toBe("25%");
  fireEvent.pointerLeave(hero);
});

it("opens the studio at once when motion is reduced", () => {
  useStudio.getState().setHealth(null, "network");
  render(<HomePage />);
  expect(screen.getAllByText("jev unreachable").length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByRole("button", { name: /Open studio/ })[0]);
  expect(window.location.pathname).toBe("/studio");
});

it("opens the studio behind a wipe otherwise", () => {
  reduced = false;
  vi.useFakeTimers();
  render(<HomePage />);
  fireEvent.click(screen.getAllByRole("button", { name: /Open studio/ })[0], { clientX: 40, clientY: 30 });
  expect(window.location.pathname).toBe("/");
  act(() => vi.advanceTimersByTime(COVER_MS));
  expect(window.location.pathname).toBe("/studio");
});
