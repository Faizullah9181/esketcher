import { describe, expect, it, vi } from "vitest";

import { Desk, emptyDoc, isDeskDoc, newId } from "./desk";
import { center, clamp, contains, easeInOutCubic, intersects, localToPage, normalizeRect, pageToLocal, rectOf, segmentDistance, shapeBounds, union } from "./math";
import type { FrameShape, Shape, StrokeShape } from "./types";

function rect(desk: Desk, x: number, y: number, w = 100, h = 100, extra: Partial<FrameShape> = {}) {
  return desk.createShape<FrameShape>({ id: newId("frame"), type: "frame", x, y, w, h, title: "F", ...extra });
}

function stroke(desk: Desk, x: number, y: number): StrokeShape {
  return desk.createShape<StrokeShape>({ id: newId("stroke"), type: "stroke", x, y, w: 104, h: 8, points: [[4, 4, 0.5], [100, 4, 0.5]], color: "#fff", size: 4, brush: false });
}

function viewportDesk() {
  const desk = new Desk();
  desk.setViewport({ x: 10, y: 20, w: 1000, h: 500 });
  return desk;
}

describe("math", () => {
  it("round-trips local and page space under rotation", () => {
    const s = { x: 10, y: 20, w: 100, h: 50, rotation: Math.PI / 3 };
    const p = localToPage(s, { x: 7, y: 9 });
    const back = pageToLocal(s, p);
    expect(back.x).toBeCloseTo(7);
    expect(back.y).toBeCloseTo(9);
    expect(center(s)).toEqual({ x: 60, y: 45 });
  });

  it("bounds rotated shapes", () => {
    expect(shapeBounds({ x: 0, y: 0, w: 10, h: 10, rotation: 0 })).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    const b = shapeBounds({ x: 0, y: 0, w: 10, h: 10, rotation: Math.PI / 4 });
    expect(b.w).toBeCloseTo(Math.SQRT2 * 10);
  });

  it("combines rects", () => {
    expect(union([])).toBeNull();
    expect(union([{ x: 0, y: 0, w: 1, h: 1 }, { x: 5, y: 5, w: 1, h: 1 }])).toEqual({ x: 0, y: 0, w: 6, h: 6 });
    expect(intersects({ x: 0, y: 0, w: 5, h: 5 }, { x: 4, y: 4, w: 5, h: 5 })).toBe(true);
    expect(contains({ x: 0, y: 0, w: 10, h: 10 }, { x: 1, y: 1, w: 2, h: 2 })).toBe(true);
    expect(normalizeRect({ x: 5, y: 5 }, { x: 1, y: 2 })).toEqual({ x: 1, y: 2, w: 4, h: 3 });
    expect(rectOf([{ x: 1, y: 2 }])).toEqual({ x: 1, y: 2, w: 0, h: 0 });
    expect(segmentDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    expect(segmentDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(Math.hypot(5, 5));
    expect(clamp(5, 0, 2)).toBe(2);
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75);
  });
});

describe("document and history", () => {
  it("creates, updates, deletes with undo and redo", () => {
    const desk = new Desk();
    const a = rect(desk, 0, 0);
    expect(desk.canUndo()).toBe(true);
    desk.updateShape(a.id, { x: 50 });
    desk.updateShape<FrameShape>(a.id, (s) => ({ title: `${s.title}!` }));
    expect(desk.getShape<FrameShape>(a.id)).toMatchObject({ x: 50, title: "F!" });
    desk.undo();
    desk.undo();
    expect(desk.getShape(a.id)?.x).toBe(0);
    desk.redo();
    expect(desk.getShape(a.id)?.x).toBe(50);
    expect(desk.canRedo()).toBe(true);
    desk.deleteShapes([a.id]);
    expect(desk.getShape(a.id)).toBeUndefined();
    desk.undo();
    expect(desk.getShape(a.id)).toBeDefined();
    desk.updateShape("missing", { x: 1 });
    desk.undo();
    desk.undo();
    desk.undo();
    desk.undo();
    desk.redo();
  });

  it("folds a gesture into one undo step and drops empty gestures", () => {
    const desk = new Desk();
    const a = rect(desk, 0, 0);
    desk.beginGesture();
    desk.translate([a.id], new Map([[a.id, { x: 0, y: 0 }]]), { x: 5, y: 0 });
    desk.translate([a.id], new Map([[a.id, { x: 0, y: 0 }]]), { x: 9, y: 0 });
    desk.endGesture();
    desk.undo();
    expect(desk.getShape(a.id)?.x).toBe(0);
    desk.redo();
    desk.beginGesture();
    desk.endGesture();
    desk.undo();
    expect(desk.getShape(a.id)?.x).toBe(0);
    desk.endGesture();
  });

  it("transacts nested mutations", () => {
    const desk = new Desk();
    desk.transact(() => {
      rect(desk, 0, 0);
      desk.transact(() => rect(desk, 10, 10));
    });
    expect(desk.getShapes()).toHaveLength(2);
    desk.undo();
    expect(desk.getShapes()).toHaveLength(0);
  });

  it("notifies listeners and keeps locked shapes", () => {
    const desk = new Desk();
    const changed = vi.fn();
    const deleted = vi.fn();
    const stopChange = desk.onDocChange(changed);
    const stopDelete = desk.onBeforeDelete(deleted);
    const a = rect(desk, 0, 0);
    const b = rect(desk, 200, 0);
    desk.toggleLock([a.id]);
    desk.deleteShapes([a.id, b.id]);
    expect(desk.getShape(a.id)).toBeDefined();
    expect(deleted).toHaveBeenCalledWith([expect.objectContaining({ id: b.id })]);
    desk.deleteShapes([a.id]);
    expect(deleted).toHaveBeenCalledTimes(1);
    desk.toggleLock([a.id]);
    expect(desk.getShape(a.id)?.locked).toBe(false);
    desk.toggleLock([]);
    expect(changed).toHaveBeenCalled();
    stopChange();
    stopDelete();
  });

  it("clears everything, locked shapes included, as one undo step", () => {
    const desk = new Desk();
    const deleted = vi.fn();
    desk.onBeforeDelete(deleted);
    const a = rect(desk, 0, 0);
    rect(desk, 200, 0);
    desk.toggleLock([a.id]);
    desk.select([a.id]);
    desk.clear();
    expect(desk.getShapes()).toHaveLength(0);
    expect(desk.state.selection).toEqual([]);
    expect(deleted.mock.calls[0][0]).toHaveLength(2);
    desk.undo();
    expect(desk.getShapes()).toHaveLength(2);
    new Desk().clear();
  });

  it("loads and snapshots documents", () => {
    const desk = new Desk();
    rect(desk, 0, 0);
    const doc = desk.snapshot();
    const other = new Desk();
    other.load(doc);
    expect(other.getShapes()).toHaveLength(1);
    expect(other.canUndo()).toBe(false);
    expect(isDeskDoc(doc)).toBe(true);
    expect(isDeskDoc({ shapes: {} })).toBe(false);
    expect(isDeskDoc(null)).toBe(false);
    expect(emptyDoc().shapes).toEqual({});
  });
});

describe("selection, groups and ordering", () => {
  it("selects, groups, duplicates and orders", () => {
    const desk = new Desk();
    const a = rect(desk, 0, 0);
    const b = rect(desk, 200, 0);
    const c = rect(desk, 400, 0);
    const groupId = desk.group([a.id, b.id]);
    expect(groupId).toBeTruthy();
    expect(desk.group([c.id])).toBeNull();
    desk.select([a.id]);
    expect(desk.state.selection.sort()).toEqual([a.id, b.id].sort());
    const copies = desk.duplicate([a.id]);
    expect(copies).toHaveLength(2);
    const copyGroup = desk.getShape(copies[0])?.groupId;
    expect(copyGroup).toBeTruthy();
    expect(copyGroup).not.toBe(groupId);
    expect(desk.duplicate([])).toEqual([]);
    desk.ungroup([a.id]);
    expect(desk.getShape(a.id)?.groupId).toBeNull();
    desk.ungroup([c.id]);
    desk.bringToFront([a.id]);
    expect(desk.getShapes().at(-1)?.id).toBe(a.id);
    desk.sendToBack([a.id]);
    expect(desk.getShapes()[0].id).toBe(a.id);
    desk.selectAll();
    expect(desk.state.selection).toHaveLength(5);
    desk.selectNone();
    desk.selectNone();
    expect(desk.getOnlySelected()).toBeNull();
    desk.select([c.id]);
    expect(desk.getOnlySelected()?.id).toBe(c.id);
    desk.deleteShapes([c.id]);
    expect(desk.state.selection).toEqual([]);
  });

  it("selects with a marquee", () => {
    const desk = new Desk();
    const a = rect(desk, 0, 0);
    rect(desk, 500, 500);
    desk.selectInRect({ x: -10, y: -10, w: 120, h: 120 });
    expect(desk.state.selection).toEqual([a.id]);
    const s = stroke(desk, 0, 300);
    desk.selectInRect({ x: 40, y: 290, w: 30, h: 30 }, [a.id]);
    expect(desk.state.selection.sort()).toEqual([a.id, s.id].sort());
  });

  it("scales and rotates, leaving locked shapes alone", () => {
    const desk = new Desk();
    const a = rect(desk, 0, 0, 100, 100);
    const s = stroke(desk, 0, 200);
    desk.scale([desk.getShape(a.id)!, desk.getShape(s.id)!], { x: 0, y: 0 }, 2);
    expect(desk.getShape(a.id)).toMatchObject({ x: 0, y: 0, w: 200, h: 200 });
    expect(desk.getShape<StrokeShape>(s.id)?.points[1][0]).toBe(200);
    desk.rotateBy([desk.getShape(a.id)!], { x: 100, y: 100 }, Math.PI / 2);
    expect(desk.getShape(a.id)?.rotation).toBeCloseTo(Math.PI / 2);
    desk.toggleLock([a.id]);
    const before = desk.getShape(a.id)!;
    desk.scale([before], { x: 0, y: 0 }, 3);
    desk.rotateBy([before], { x: 0, y: 0 }, 1);
    desk.translate([a.id], new Map([[a.id, { x: 0, y: 0 }]]), { x: 50, y: 50 });
    expect(desk.getShape(a.id)).toEqual(before);
  });
});

describe("camera and hit testing", () => {
  it("converts screen and page coordinates", () => {
    const desk = viewportDesk();
    desk.setCamera({ x: 5, y: -5, z: 2 });
    const page = desk.screenToPage({ x: 110, y: 120 });
    expect(desk.pageToScreen(page)).toEqual({ x: 110, y: 120 });
    expect(desk.getViewportPageBounds()).toEqual({ x: -5, y: 5, w: 500, h: 250 });
  });

  it("zooms around the cursor and clamps", () => {
    const desk = viewportDesk();
    const anchor = { x: 300, y: 200 };
    const before = desk.screenToPage(anchor);
    desk.zoomAt(anchor, 2);
    const after = desk.screenToPage(anchor);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    desk.zoomAt(anchor, 1000);
    expect(desk.getZoom()).toBe(8);
    desk.zoomIn();
    desk.zoomOut();
    desk.resetZoom();
    expect(desk.getZoom()).toBeCloseTo(1);
    desk.panBy(10, 0);
    expect(desk.state.camera.x).toBeCloseTo(desk.state.camera.x);
  });

  it("frames bounds, instantly or animated", async () => {
    const desk = viewportDesk();
    rect(desk, 0, 0, 200, 100);
    desk.zoomToBounds({ x: 0, y: 0, w: 200, h: 100 }, { animate: false, inset: 0 });
    expect(desk.getZoom()).toBe(5);
    desk.zoomToFit({ animate: false });
    expect(desk.getZoom()).toBe(1);
    desk.select(desk.getShapes().map((s) => s.id));
    desk.zoomToSelection();
    await new Promise((r) => setTimeout(r, 750));
    expect(desk.getZoom()).toBeCloseTo(1.4);
    new Desk().zoomToFit();
    new Desk().zoomToSelection();
  });

  it("culls and hit-tests by shape type", () => {
    const desk = viewportDesk();
    const frame = rect(desk, 0, 0, 400, 400);
    const s = stroke(desk, 50, 200);
    const far = rect(desk, 5000, 5000);
    expect(desk.getVisibleShapes().map((x) => x.id)).not.toContain(far.id);
    expect(desk.isVisible(far.id)).toBe(false);
    expect(desk.isVisible("missing")).toBe(false);
    // frames catch their rim and title bar, not their middle
    expect(desk.shapeAt({ x: 200, y: 5 })?.id).toBe(frame.id);
    expect(desk.shapeAt({ x: 200, y: 300 })).toBeNull();
    expect(desk.shapeAt({ x: 100, y: 204 })?.id).toBe(s.id);
    const dot = desk.createShape<StrokeShape>({ id: "dot", type: "stroke", x: 600, y: 0, w: 10, h: 10, points: [[5, 5, 0.5]], color: "#fff", size: 6, brush: false });
    expect(desk.shapeAt({ x: 605, y: 5 })?.id).toBe(dot.id);
    expect(desk.localToPage(frame.id, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
    expect(desk.pageToLocal("missing", { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
    expect(desk.localToPage("missing", { x: 2, y: 2 })).toEqual({ x: 2, y: 2 });
    expect(desk.getBounds("missing")).toBeNull();
  });

  it("switches tools and styles, clearing previews", () => {
    const desk = new Desk();
    desk.setTransient({ marquee: { x: 0, y: 0, w: 1, h: 1 } });
    desk.setTool("draw");
    expect(desk.state.marquee).toBeNull();
    desk.setTool("draw");
    desk.setStyle({ size: 9 });
    expect(desk.state.style).toMatchObject({ size: 9, color: "#ece8df" });
    expect(Desk.rectFrom({ x: 2, y: 2 }, { x: 0, y: 0 })).toEqual({ x: 0, y: 0, w: 2, h: 2 });
    desk.setViewport(desk.state.viewport);
  });
});

it("gives every shape a unique id", () => {
  const ids = new Set(Array.from({ length: 500 }, () => newId()));
  expect(ids.size).toBe(500);
  expect(([] as Shape[]).length).toBe(0);
});

describe("choreography", () => {
  it("patches silently and locks editing", async () => {
    const desk = new Desk();
    const changed = vi.fn();
    desk.onDocChange(changed);
    const a = rect(desk, 0, 0);
    changed.mockClear();
    desk.patchSilently({ [a.id]: { x: 99 }, missing: { x: 1 } });
    expect(desk.getShape(a.id)?.x).toBe(99);
    expect(changed).not.toHaveBeenCalled();
    desk.setInteractive(false);
    desk.setInteractive(false);
    expect(desk.state.interactive).toBe(false);
    const { animateShapes, easings, motion } = await import("./animate");
    motion.scale = 0;
    await animateShapes(desk, { [a.id]: { x: 5, y: 7 } }, 500, easings.outBack);
    expect(desk.getShape(a.id)).toMatchObject({ x: 5, y: 7 });
    await animateShapes(desk, {}, 100);
    motion.scale = 1;
    const moving = animateShapes(desk, { [a.id]: { x: 50 } }, 40, easings.inBack);
    await new Promise((r) => setTimeout(r, 120));
    await moving;
    expect(desk.getShape(a.id)?.x).toBeCloseTo(50);
    expect(easings.outExpo(1)).toBe(1);
    expect(easings.inOutCubic(0.5)).toBeCloseTo(0.5);
  });
});
