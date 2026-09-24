import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Desk } from "@/lib/desk/desk";
import { useStudio } from "@/state/studio";
import { setupDesk } from "@/test/desk";

import { DeskCanvas } from "./DeskCanvas";

vi.mock("@/state/jevController", () => ({ requestDecision: vi.fn(async () => null), applyManual: vi.fn(() => true) }));
const controller = await import("@/state/jevController");

let desk: Desk;
let ids: string[];

beforeEach(() => {
  vi.clearAllMocks();
  ({ desk, ids } = setupDesk(2));
});

const canvas = () => screen.getByRole("application", { name: "Sketch desk" });
const pointer = (type: string, x: number, y: number, extra = {}) =>
  fireEvent[type as "pointerDown"](canvas(), { clientX: x, clientY: y, pointerId: 1, button: 0, ...extra });

describe("DeskCanvas", () => {
  it("renders visible boards and the desk index", () => {
    render(<DeskCanvas desk={desk} />);
    act(() => desk.setViewport({ x: 0, y: 0, w: 1200, h: 800 }));
    expect(document.querySelectorAll("[data-shape]")).toHaveLength(2);
    expect(screen.getByText(/2 sketches/)).toBeInTheDocument();
  });

  it("selects, drags and syncs focus to the Jev panel", async () => {
    vi.useFakeTimers();
    render(<DeskCanvas desk={desk} />);
    // jsdom has no layout, so the viewport sits at the origin
    act(() => desk.setViewport({ x: 0, y: 0, w: 1200, h: 800 }));
    pointer("pointerDown", 100, 100);
    pointer("pointerMove", 140, 100);
    pointer("pointerUp", 140, 100);
    expect(desk.getShape(ids[0])?.x).toBe(40);
    expect(useStudio.getState().focus).toEqual({ boardId: ids[0], regionId: null });
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(controller.requestDecision).toHaveBeenCalledWith({ boardId: ids[0], regionId: null, autoApply: false });
    pointer("pointerDown", 1100, 700);
    pointer("pointerUp", 1100, 700);
    expect(useStudio.getState().focus).toBeNull();
    vi.useRealTimers();
  });

  it("handles keyboard shortcuts, but not while typing", () => {
    render(
      <>
        <input aria-label="field" />
        <DeskCanvas desk={desk} />
      </>,
    );
    fireEvent.keyDown(window, { key: "j" });
    expect(desk.state.tool).toBe("jev");
    fireEvent.keyDown(screen.getByLabelText("field"), { key: "v" });
    expect(desk.state.tool).toBe("jev");
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyUp(window, { key: " " });
  });

  it("uses the Jev tool on regions", () => {
    render(<DeskCanvas desk={desk} />);
    act(() => desk.setViewport({ x: 0, y: 0, w: 1200, h: 800 }));
    act(() => desk.setTool("jev"));
    pointer("pointerMove", 160, 200);
    expect(useStudio.getState().hover?.boardId).toBe(ids[0]);
    pointer("pointerDown", 160, 200);
    pointer("pointerUp", 160, 200);
    expect(controller.requestDecision).toHaveBeenCalledWith(expect.objectContaining({ boardId: ids[0], autoApply: true }));
    fireEvent.pointerLeave(canvas());
    expect(useStudio.getState().hover).toBeNull();
  });

  it("opens a context menu and runs its actions", () => {
    render(<DeskCanvas desk={desk} />);
    act(() => desk.setViewport({ x: 0, y: 0, w: 1200, h: 800 }));
    fireEvent.contextMenu(canvas(), { clientX: 100, clientY: 100 });
    fireEvent.click(screen.getByRole("menuitem", { name: /Duplicate/ }));
    expect(desk.getShapes()).toHaveLength(3);
    fireEvent.contextMenu(canvas(), { clientX: 1100, clientY: 700 });
    fireEvent.click(screen.getByRole("menuitem", { name: /Select all/ }));
    expect(desk.state.selection).toHaveLength(3);
    fireEvent.contextMenu(canvas(), { clientX: 100, clientY: 100 });
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete/ }));
    expect(desk.getShapes().length).toBeLessThan(3);
    expect(useStudio.getState().bursts.length).toBeGreaterThan(0);
  });

  it("zooms with the wheel and pinches with two fingers", () => {
    render(<DeskCanvas desk={desk} />);
    fireEvent.wheel(canvas(), { clientX: 0, clientY: 0, deltaY: -100, ctrlKey: true });
    expect(desk.getZoom()).toBeGreaterThan(1);
    const z = desk.getZoom();
    fireEvent.pointerDown(canvas(), { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerDown(canvas(), { clientX: 100, clientY: 0, pointerId: 2 });
    fireEvent.pointerMove(canvas(), { clientX: 200, clientY: 0, pointerId: 2 });
    expect(desk.getZoom()).toBeGreaterThan(z);
    fireEvent.pointerUp(canvas(), { clientX: 200, clientY: 0, pointerId: 2 });
    fireEvent.pointerUp(canvas(), { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerCancel(canvas(), { pointerId: 1 });
  });

  it("shows the empty state and the pen style panel", () => {
    desk.deleteShapes(ids);
    render(<DeskCanvas desk={desk} />);
    expect(screen.getByText("Your canvas is empty.")).toBeInTheDocument();
    act(() => desk.setTool("draw"));
    fireEvent.click(screen.getByLabelText("Colour #c6ff3d"));
    fireEvent.click(screen.getByLabelText("Size 8"));
    expect(desk.state.style).toEqual({ color: "#c6ff3d", size: 8 });
  });
});
