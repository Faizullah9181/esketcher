import { beforeEach, describe, expect, it, vi } from "vitest";

import { Desk, newId } from "./desk";
import { GestureController, type GestureHooks } from "./gestures";
import { strokeFromPoints, strokePath, outlinePath } from "./strokes";
import type { BoardShape, FrameShape, StrokeShape } from "./types";

let desk: Desk;
let hooks: GestureHooks;
let g: GestureController;

function board(x: number, y: number, locked = false) {
  return desk.createShape<BoardShape>({
    id: newId("board"),
    type: "board",
    x,
    y,
    w: 320,
    h: 400,
    locked,
    props: { num: 1, sketchId: "sk-001", title: "T", category: "eyes", variant: 0, seed: 1, complexity: 0.5, paints: {}, lockedMaterial: null },
  });
}

beforeEach(() => {
  desk = new Desk();
  desk.setViewport({ x: 0, y: 0, w: 1000, h: 800 });
  hooks = { onRegion: vi.fn(), onHover: vi.fn(), onOpenBoard: vi.fn() };
  g = new GestureController(desk, hooks);
});

const drag = (from: [number, number], to: [number, number], extra = {}) => {
  g.down({ x: from[0], y: from[1], ...extra });
  g.move({ x: (from[0] + to[0]) / 2, y: (from[1] + to[1]) / 2, ...extra });
  g.move({ x: to[0], y: to[1], ...extra });
  g.up({ x: to[0], y: to[1], ...extra });
};

describe("select tool", () => {
  it("selects and drags shapes as one undo step", () => {
    const b = board(0, 0);
    drag([100, 100], [150, 120]);
    expect(desk.state.selection).toEqual([b.id]);
    expect(desk.getShape(b.id)).toMatchObject({ x: 50, y: 20 });
    desk.undo();
    expect(desk.getShape(b.id)).toMatchObject({ x: 0, y: 0 });
  });

  it("ignores jitter below the drag threshold", () => {
    const b = board(0, 0);
    drag([100, 100], [101, 101]);
    expect(desk.getShape(b.id)?.x).toBe(0);
  });

  it("toggles with shift and marquee-selects on empty space", () => {
    const a = board(0, 0);
    const b = board(400, 0);
    g.down({ x: 10, y: 10 });
    g.up({ x: 10, y: 10 });
    g.down({ x: 410, y: 10, shift: true });
    g.up({ x: 410, y: 10 });
    expect(desk.state.selection.sort()).toEqual([a.id, b.id].sort());
    g.down({ x: 410, y: 10, shift: true });
    g.up({ x: 410, y: 10 });
    expect(desk.state.selection).toEqual([a.id]);
    drag([-50, -50], [900, 500]);
    expect(desk.state.selection.sort()).toEqual([a.id, b.id].sort());
    expect(desk.state.marquee).toBeNull();
    g.down({ x: 900, y: 700 });
    g.up({ x: 900, y: 700 });
    expect(desk.state.selection).toEqual([]);
  });

  it("selects but never moves locked shapes", () => {
    const b = board(0, 0, true);
    drag([100, 100], [200, 200]);
    expect(desk.state.selection).toEqual([b.id]);
    expect(desk.getShape(b.id)?.x).toBe(0);
  });

  it("scales from the opposite corner and rotates with snapping", () => {
    const b = board(0, 0);
    desk.select([b.id]);
    drag([320, 400], [640, 800], { handle: "se" });
    expect(desk.getShape(b.id)).toMatchObject({ x: 0, y: 0, w: 640, h: 800 });
    for (const handle of ["nw", "ne", "sw"] as const) {
      g.down({ x: 0, y: 0, handle });
      g.up({ x: 0, y: 0 });
    }
    drag([320, -100], [900, 400], { handle: "rotate", shift: true });
    const r = desk.getShape(b.id)!.rotation;
    expect(Math.abs(r / (Math.PI / 12) - Math.round(r / (Math.PI / 12)))).toBeLessThan(1e-9);
    desk.selectNone();
    g.down({ x: 0, y: 0, handle: "se" });
    expect(g.mode.kind).toBe("idle");
  });

  it("opens boards on double click", () => {
    const b = board(0, 0);
    g.doubleClick({ x: 10, y: 10 });
    expect(hooks.onOpenBoard).toHaveBeenCalledWith(expect.objectContaining({ id: b.id }));
    g.doubleClick({ x: 900, y: 700 });
    expect(hooks.onOpenBoard).toHaveBeenCalledTimes(1);
  });
});

describe("navigation", () => {
  it("pans with the hand tool, middle button or space", () => {
    desk.setTool("hand");
    drag([100, 100], [150, 100]);
    expect(desk.state.camera.x).toBe(50);
    desk.setTool("select");
    drag([0, 0], [0, 30], { button: 1 });
    expect(desk.state.camera.y).toBe(30);
    g.keyDown({ key: " " });
    drag([0, 0], [10, 0]);
    g.keyUp({ key: " " });
    g.keyUp({ key: "x" });
    expect(desk.state.camera.x).toBe(60);
    expect(g.space).toBe(false);
  });

  it("zooms with the zoom tool and the wheel", () => {
    desk.setTool("zoom");
    g.down({ x: 500, y: 400 });
    expect(desk.getZoom()).toBeCloseTo(1.25);
    g.down({ x: 500, y: 400, alt: true });
    expect(desk.getZoom()).toBeCloseTo(1);
    g.wheel({ x: 0, y: 0, dx: 0, dy: -100, mod: true });
    expect(desk.getZoom()).toBeGreaterThan(1);
    g.wheel({ x: 0, y: 0, dx: 10, dy: 20 });
    expect(desk.state.camera.x).toBeLessThan(0);
  });
});

describe("drawing tools", () => {
  it("draws a stroke and erases it", () => {
    desk.setTool("draw");
    g.down({ x: 10, y: 10 });
    g.move({ x: 10.2, y: 10 });
    g.move({ x: 60, y: 40, pressure: 0.8 });
    expect(desk.state.draft?.type).toBe("stroke");
    g.up({ x: 60, y: 40 });
    const stroke = desk.getShapes().find((s): s is StrokeShape => s.type === "stroke")!;
    expect(stroke.points).toHaveLength(2);
    expect(desk.state.draft).toBeNull();
    desk.setTool("eraser");
    g.down({ x: 35, y: 25 });
    g.move({ x: 36, y: 26 });
    expect(desk.state.erasing).toEqual([stroke.id]);
    g.up({ x: 36, y: 26 });
    expect(desk.getShape(stroke.id)).toBeUndefined();
  });

  it("draws translucent brush strokes", () => {
    desk.setTool("highlight");
    drag([0, 0], [80, 0]);
    expect(desk.getShapes()[0]).toMatchObject({ type: "stroke", brush: true, size: 12 });
  });

  it("creates frames behind everything, ignoring tiny drags", () => {
    const b = board(0, 0);
    desk.setTool("frame");
    drag([0, 0], [5, 5]);
    expect(desk.getShapes()).toHaveLength(1);
    drag([-50, -50], [500, 600]);
    const frame = desk.getShapes()[0] as FrameShape;
    expect(frame.type).toBe("frame");
    expect(frame.z).toBeLessThan(desk.getShape(b.id)!.z);
    expect(desk.state.tool).toBe("select");
    expect(desk.state.selection).toEqual([frame.id]);
  });

  it("builds stroke geometry", () => {
    const s = strokeFromPoints([[0, 0, 0.5], [10, 10, 0.5]], { color: "#fff", size: 4 }, false);
    expect(s).toMatchObject({ x: -4, y: -4, w: 18, h: 18 });
    expect(strokePath(s.points, 4, false)).toMatch(/^M .*Z$/);
    expect(strokePath([[0, 0, 0.9], [5, 5, 0.2]], 4, true)).toMatch(/Z$/);
    expect(outlinePath([])).toBe("");
  });
});

describe("region tools", () => {
  it("routes clicks and hovers to the hooks", () => {
    const b = board(0, 0);
    board(400, 0, true);
    desk.setTool("jev");
    g.move({ x: 100, y: 100 });
    expect(hooks.onHover).toHaveBeenCalledWith(expect.objectContaining({ id: b.id }), expect.anything());
    g.down({ x: 100, y: 100 });
    expect(hooks.onRegion).toHaveBeenCalledWith("jev", expect.objectContaining({ id: b.id }), expect.anything());
    desk.select([b.id]);
    g.down({ x: 500, y: 100 });
    expect(hooks.onRegion).toHaveBeenCalledTimes(1);
    expect(desk.state.selection).toEqual([]);
  });
});

describe("while choreographed", () => {
  it("pans instead of editing and ignores shortcuts", () => {
    const b = board(0, 0);
    desk.setInteractive(false);
    drag([100, 100], [150, 100]);
    expect(desk.getShape(b.id)?.x).toBe(0);
    expect(desk.state.camera.x).toBe(50);
    expect(g.keyDown({ key: "Delete" })).toBe(false);
    g.doubleClick({ x: 60, y: 10 });
    expect(hooks.onOpenBoard).not.toHaveBeenCalled();
  });
});

describe("keyboard", () => {
  it("drives editing shortcuts", () => {
    const b = board(0, 0);
    desk.select([b.id]);
    expect(g.keyDown({ key: "d", mod: true })).toBe(true);
    expect(desk.getShapes()).toHaveLength(2);
    g.keyDown({ key: "a", mod: true });
    g.keyDown({ key: "g", mod: true });
    expect(new Set(desk.getShapes().map((s) => s.groupId)).size).toBe(1);
    g.keyDown({ key: "g", mod: true, shift: true });
    g.keyDown({ key: "z", mod: true });
    g.keyDown({ key: "z", mod: true, shift: true });
    g.keyDown({ key: "y", mod: true });
    g.keyDown({ key: "0", mod: true });
    expect(g.keyDown({ key: "q", mod: true })).toBe(false);
    desk.select([b.id]);
    g.keyDown({ key: "ArrowRight" });
    g.keyDown({ key: "ArrowDown", shift: true });
    expect(desk.getShape(b.id)).toMatchObject({ x: 1, y: 10 });
    g.keyDown({ key: "L", shift: true });
    expect(desk.getShape(b.id)?.locked).toBe(true);
    g.keyDown({ key: "L", shift: true });
    g.keyDown({ key: "]" });
    g.keyDown({ key: "[" });
    g.keyDown({ key: "!", shift: true });
    g.keyDown({ key: "@", shift: true });
    g.keyDown({ key: "=" });
    g.keyDown({ key: "-" });
    g.keyDown({ key: "Delete" });
    expect(desk.getShape(b.id)).toBeUndefined();
    g.keyDown({ key: "Backspace" });
  });

  it("switches tools and escapes", () => {
    g.keyDown({ key: "j" });
    expect(desk.state.tool).toBe("jev");
    g.keyDown({ key: "Escape" });
    expect(desk.state.tool).toBe("select");
    g.keyDown({ key: "D", shift: true });
    expect(desk.state.tool).toBe("highlight");
    g.keyDown({ key: "Escape" });
    g.keyDown({ key: "Escape" });
    expect(g.keyDown({ key: "x" })).toBe(false);
    expect(g.keyDown({ key: "ArrowLeft" })).toBe(false);
  });

  it("cancels in-flight gestures cleanly", () => {
    const b = board(0, 0);
    g.down({ x: 10, y: 10 });
    g.move({ x: 100, y: 10 });
    g.cancel();
    expect(g.mode.kind).toBe("idle");
    desk.undo();
    expect(desk.getShape(b.id)?.x).toBe(0);
    g.cancel();
  });
});
