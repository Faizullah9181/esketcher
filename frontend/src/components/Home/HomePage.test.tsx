import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { initialStudio, useStudio } from "@/state/studio";
import { MATERIALS, sketch } from "@/test/fixtures";

import { HomePage } from "./HomePage";

const CATEGORIES = ["eyes", "flowers", "mechanical", "insects", "planets"] as const;

beforeEach(() => {
  useStudio.setState(initialStudio);
  useStudio.getState().setCatalog(MATERIALS, CATEGORIES.map((category, i) => sketch({ id: `sk-00${i}`, category, title: category })));
});
afterEach(() => {
  vi.useRealTimers();
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
});

it("paints its preview sketches over time and starts over when full", () => {
  vi.useFakeTimers();
  const { container } = render(<HomePage />);
  expect(container.querySelectorAll(".es-board")).toHaveLength(5);
  act(() => vi.advanceTimersByTime(1100 * 400));
  expect(container.querySelectorAll("clipPath[id$='-clip']").length).toBeGreaterThan(20);
});

it("opens the studio", () => {
  useStudio.getState().setHealth(null, "network");
  render(<HomePage />);
  expect(screen.getAllByText("jev unreachable").length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByRole("button", { name: /Open studio/ })[0]);
  expect(window.location.pathname).toBe("/studio");
});
