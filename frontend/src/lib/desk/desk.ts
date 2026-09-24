/**
 * The desk: eSketcher's own infinite-canvas engine.
 *
 * Plain TypeScript over a vanilla zustand store, so React subscribes with
 * selectors and everything else (tools, the Jev controller, tests) drives it
 * directly. Screen space is the browser's client coordinates; page space is the
 * infinite desk. screen = (page + camera) * zoom + viewport offset.
 */
import { createStore, type StoreApi } from "zustand/vanilla";

import { center, clamp, contains, easeInOutCubic, intersects, localToPage, normalizeRect, pageToLocal, rotate, segmentDistance, shapeBounds, union } from "./math";
import type { Camera, DeskDoc, Rect, Shape, ShapeId, StrokeStyle, ToolId, Vec } from "./types";

export const MIN_ZOOM = 0.08;
export const MAX_ZOOM = 8;
const HISTORY_LIMIT = 200;
const CAMERA_MS = 650;

export interface DeskState {
  doc: DeskDoc;
  camera: Camera;
  selection: ShapeId[];
  tool: ToolId;
  /** container rect in client coordinates */
  viewport: Rect;
  style: StrokeStyle;
  /** transient previews owned by the gesture controller */
  marquee: Rect | null;
  draft: Shape | null;
  erasing: ShapeId[];
  canUndo: boolean;
  canRedo: boolean;
  /** false while something (the sampling carousel) choreographs shapes: editing pauses, panning still works */
  interactive: boolean;
}

type DocListener = (doc: DeskDoc) => void;
type DeleteListener = (shapes: Shape[]) => void;

let counter = 0;
export const newId = (prefix = "shape") => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const emptyDoc = (): DeskDoc => ({ version: 1, shapes: {} });

export class Desk {
  readonly store: StoreApi<DeskState>;
  private past: DeskDoc[] = [];
  private future: DeskDoc[] = [];
  private gesture: DeskDoc | null = null;
  private docListeners = new Set<DocListener>();
  private deleteListeners = new Set<DeleteListener>();
  private animation = 0;

  constructor(doc: DeskDoc = emptyDoc()) {
    this.store = createStore<DeskState>(() => ({
      doc,
      camera: { x: 0, y: 0, z: 1 },
      selection: [],
      tool: "select",
      viewport: { x: 0, y: 0, w: 1200, h: 800 },
      style: { color: "#ece8df", size: 4 },
      marquee: null,
      draft: null,
      erasing: [],
      canUndo: false,
      canRedo: false,
      interactive: true,
    }));
  }

  // ── reads ────────────────────────────────────────────────────────────────

  get state(): DeskState {
    return this.store.getState();
  }

  getShape<T extends Shape = Shape>(id: ShapeId): T | undefined {
    return this.state.doc.shapes[id] as T | undefined;
  }

  /** All shapes, bottom to top. */
  getShapes(): Shape[] {
    return Object.values(this.state.doc.shapes).sort((a, b) => a.z - b.z);
  }

  getSelected(): Shape[] {
    return this.state.selection.map((id) => this.getShape(id)).filter((s): s is Shape => Boolean(s));
  }

  getOnlySelected(): Shape | null {
    const selected = this.getSelected();
    return selected.length === 1 ? selected[0] : null;
  }

  getBounds(id: ShapeId): Rect | null {
    const shape = this.getShape(id);
    return shape ? shapeBounds(shape) : null;
  }

  selectionBounds(): Rect | null {
    return union(this.getSelected().map(shapeBounds));
  }

  getZoom(): number {
    return this.state.camera.z;
  }

  getViewportPageBounds(): Rect {
    const { viewport, camera } = this.state;
    return { x: -camera.x, y: -camera.y, w: viewport.w / camera.z, h: viewport.h / camera.z };
  }

  isVisible(id: ShapeId, margin = 0): boolean {
    const b = this.getBounds(id);
    if (!b) return false;
    const v = this.getViewportPageBounds();
    return intersects({ x: v.x - margin, y: v.y - margin, w: v.w + margin * 2, h: v.h + margin * 2 }, b);
  }

  /** Shapes to render: everything intersecting the viewport, plus a margin. */
  getVisibleShapes(marginPx = 240): Shape[] {
    const v = this.getViewportPageBounds();
    const m = marginPx / this.state.camera.z;
    const area = { x: v.x - m, y: v.y - m, w: v.w + m * 2, h: v.h + m * 2 };
    return this.getShapes().filter((s) => intersects(area, shapeBounds(s)));
  }

  pageToScreen(p: Vec): Vec {
    const { camera, viewport } = this.state;
    return { x: (p.x + camera.x) * camera.z + viewport.x, y: (p.y + camera.y) * camera.z + viewport.y };
  }

  screenToPage(p: Vec): Vec {
    const { camera, viewport } = this.state;
    return { x: (p.x - viewport.x) / camera.z - camera.x, y: (p.y - viewport.y) / camera.z - camera.y };
  }

  localToPage(id: ShapeId, p: Vec): Vec {
    const shape = this.getShape(id);
    return shape ? localToPage(shape, p) : p;
  }

  pageToLocal(id: ShapeId, p: Vec): Vec {
    const shape = this.getShape(id);
    return shape ? pageToLocal(shape, p) : p;
  }

  /** Topmost shape under a page point. Frames only catch their title bar and rim. */
  shapesAt(p: Vec, tolerance = 4): Shape[] {
    const slack = tolerance / this.state.camera.z;
    return this.getShapes()
      .reverse()
      .filter((s) => {
        const l = pageToLocal(s, p);
        const inside = l.x >= -slack && l.y >= -slack && l.x <= s.w + slack && l.y <= s.h + slack;
        if (!inside) return false;
        if (s.type === "frame") {
          const rim = 10 / this.state.camera.z;
          return l.y <= 28 / this.state.camera.z || l.x <= rim || l.y <= rim || l.x >= s.w - rim || l.y >= s.h - rim;
        }
        if (s.type === "stroke") {
          const reach = s.size / 2 + slack + 2;
          const pts = s.points.map(([x, y]) => ({ x, y }));
          if (pts.length === 1) return Math.hypot(pts[0].x - l.x, pts[0].y - l.y) <= reach;
          return pts.some((q, i) => i > 0 && segmentDistance(l, pts[i - 1], q) <= reach);
        }
        return true;
      });
  }

  shapeAt(p: Vec): Shape | null {
    return this.shapesAt(p)[0] ?? null;
  }

  canUndo() {
    return this.state.canUndo;
  }

  canRedo() {
    return this.state.canRedo;
  }

  // ── document mutations (each is one undo step unless inside a gesture) ────

  private commit(mutate: (shapes: Record<ShapeId, Shape>) => Record<ShapeId, Shape> | void, notify = true): void {
    const before = this.state.doc;
    const shapes = { ...before.shapes };
    const result = mutate(shapes) ?? shapes;
    const doc: DeskDoc = { version: 1, shapes: result };
    if (!this.gesture) {
      this.past.push(before);
      if (this.past.length > HISTORY_LIMIT) this.past.shift();
      this.future = [];
    }
    this.store.setState({ doc, canUndo: this.past.length > 0 || this.gesture !== null, canRedo: this.future.length > 0 });
    this.pruneSelection();
    if (notify) this.docListeners.forEach((l) => l(doc));
  }

  /** Animation frames: change shapes without an undo step or a change notification.
   * The next normal mutation carries the result into history and autosave. */
  patchSilently(patches: Record<ShapeId, Partial<Shape>>): void {
    const shapes = { ...this.state.doc.shapes };
    for (const [id, patch] of Object.entries(patches)) if (shapes[id]) shapes[id] = { ...shapes[id], ...patch } as Shape;
    this.store.setState({ doc: { version: 1, shapes } });
  }

  setInteractive(interactive: boolean): void {
    if (this.state.interactive !== interactive) this.store.setState({ interactive, marquee: null, draft: null });
  }

  /** Group several mutations (a drag, a resize) into one undo step. */
  beginGesture(): void {
    if (!this.gesture) this.gesture = this.state.doc;
  }

  endGesture(): void {
    const start = this.gesture;
    this.gesture = null;
    if (!start || start === this.state.doc) return;
    this.past.push(start);
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
    this.store.setState({ canUndo: true, canRedo: false });
  }

  /** Run several mutations as one undo step. */
  transact(fn: () => void): void {
    const outer = this.gesture !== null;
    this.beginGesture();
    try {
      fn();
    } finally {
      if (!outer) this.endGesture();
    }
  }

  private nextZ(): number {
    return this.getShapes().reduce((max, s) => Math.max(max, s.z), 0) + 1;
  }

  createShape<T extends Shape>(shape: Omit<T, "z" | "locked" | "groupId" | "rotation"> & Partial<Pick<T, "z" | "locked" | "groupId" | "rotation">>): T {
    const full = { rotation: 0, locked: false, groupId: null, z: this.nextZ(), ...shape } as T;
    this.commit((shapes) => {
      shapes[full.id] = full;
    });
    return full;
  }

  updateShape<T extends Shape>(id: ShapeId, patch: Partial<T> | ((shape: T) => Partial<T>)): void {
    const shape = this.getShape<T>(id);
    if (!shape) return;
    const next = typeof patch === "function" ? patch(shape) : patch;
    this.commit((shapes) => {
      shapes[id] = { ...shape, ...next } as Shape;
    });
  }

  updateShapes(patches: Record<ShapeId, Partial<Shape>>): void {
    this.commit((shapes) => {
      for (const [id, patch] of Object.entries(patches)) if (shapes[id]) shapes[id] = { ...shapes[id], ...patch } as Shape;
    });
  }

  deleteShapes(ids: ShapeId[]): void {
    const doomed = this.expandGroups(ids)
      .map((id) => this.getShape(id))
      .filter((s): s is Shape => Boolean(s) && !s!.locked);
    if (!doomed.length) return;
    this.deleteListeners.forEach((l) => l(doomed));
    this.commit((shapes) => {
      for (const s of doomed) delete shapes[s.id];
    });
  }

  /** Empty the desk in one undo step, locked shapes included: an explicit "start fresh". */
  clear(): void {
    const all = this.getShapes();
    if (!all.length) return;
    this.deleteListeners.forEach((l) => l(all));
    this.commit(() => ({}));
    this.store.setState({ selection: [] });
  }

  duplicate(ids: ShapeId[], offset: Vec = { x: 36, y: 36 }): ShapeId[] {
    const sources = this.expandGroups(ids)
      .map((id) => this.getShape(id))
      .filter((s): s is Shape => Boolean(s))
      .sort((a, b) => a.z - b.z);
    if (!sources.length) return [];
    const groups = new Map<string, string>();
    let z = this.nextZ();
    const copies = sources.map((s) => {
      const groupId = s.groupId ? (groups.get(s.groupId) ?? groups.set(s.groupId, newId("group")).get(s.groupId)!) : null;
      return { ...structuredClone(s), id: newId(s.type), x: s.x + offset.x, y: s.y + offset.y, z: z++, locked: false, groupId } as Shape;
    });
    this.commit((shapes) => {
      for (const c of copies) shapes[c.id] = c;
    });
    this.select(copies.map((c) => c.id));
    return copies.map((c) => c.id);
  }

  group(ids: ShapeId[]): string | null {
    const members = this.expandGroups(ids);
    if (members.length < 2) return null;
    const groupId = newId("group");
    this.updateShapes(Object.fromEntries(members.map((id) => [id, { groupId }])));
    return groupId;
  }

  ungroup(ids: ShapeId[]): void {
    const members = this.expandGroups(ids).filter((id) => this.getShape(id)?.groupId);
    if (members.length) this.updateShapes(Object.fromEntries(members.map((id) => [id, { groupId: null }])));
  }

  toggleLock(ids: ShapeId[]): void {
    const shapes = this.expandGroups(ids).map((id) => this.getShape(id)).filter((s): s is Shape => Boolean(s));
    if (!shapes.length) return;
    const lock = !shapes.every((s) => s.locked);
    this.updateShapes(Object.fromEntries(shapes.map((s) => [s.id, { locked: lock }])));
  }

  bringToFront(ids: ShapeId[]): void {
    let z = this.nextZ();
    this.updateShapes(Object.fromEntries(this.expandGroups(ids).map((id) => [id, { z: z++ }])));
  }

  sendToBack(ids: ShapeId[]): void {
    let z = Math.min(0, ...this.getShapes().map((s) => s.z)) - ids.length - 1;
    this.updateShapes(Object.fromEntries(this.expandGroups(ids).map((id) => [id, { z: z++ }])));
  }

  /** Move shapes by a page delta. */
  translate(ids: ShapeId[], origins: Map<ShapeId, Vec>, delta: Vec): void {
    this.updateShapes(
      Object.fromEntries(
        ids
          .filter((id) => !this.getShape(id)?.locked)
          .map((id) => {
            const o = origins.get(id)!;
            return [id, { x: o.x + delta.x, y: o.y + delta.y }];
          }),
      ),
    );
  }

  /** Uniformly scale shapes around an anchor (page). */
  scale(originals: Shape[], anchor: Vec, factor: number): void {
    const f = Math.max(0.05, factor);
    this.updateShapes(
      Object.fromEntries(
        originals
          .filter((s) => !s.locked)
          .map((s) => {
            const c = center(s);
            const nc = { x: anchor.x + (c.x - anchor.x) * f, y: anchor.y + (c.y - anchor.y) * f };
            const w = s.w * f;
            const h = s.h * f;
            const patch: Partial<Shape> = { x: nc.x - w / 2, y: nc.y - h / 2, w, h };
            if (s.type === "stroke") Object.assign(patch, { size: s.size * f, points: s.points.map(([x, y, pr]) => [x * f, y * f, pr]) });
            return [s.id, patch];
          }),
      ),
    );
  }

  /** Rotate shapes around a pivot (page) by delta radians. */
  rotateBy(originals: Shape[], pivot: Vec, delta: number): void {
    this.updateShapes(
      Object.fromEntries(
        originals
          .filter((s) => !s.locked)
          .map((s) => {
            const c = center(s);
            const r = rotate({ x: c.x - pivot.x, y: c.y - pivot.y }, delta);
            return [s.id, { x: pivot.x + r.x - s.w / 2, y: pivot.y + r.y - s.h / 2, rotation: s.rotation + delta }];
          }),
      ),
    );
  }

  undo(): void {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(this.state.doc);
    this.store.setState({ doc: prev, canUndo: this.past.length > 0, canRedo: true });
    this.pruneSelection();
    this.docListeners.forEach((l) => l(prev));
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.state.doc);
    this.store.setState({ doc: next, canUndo: true, canRedo: this.future.length > 0 });
    this.pruneSelection();
    this.docListeners.forEach((l) => l(next));
  }

  // ── selection, tools, transient UI ────────────────────────────────────────

  /** Every id in the same groups as `ids`. */
  expandGroups(ids: ShapeId[]): ShapeId[] {
    const groups = new Set(ids.map((id) => this.getShape(id)?.groupId).filter(Boolean));
    const out = new Set(ids.filter((id) => this.getShape(id)));
    if (groups.size) for (const s of this.getShapes()) if (s.groupId && groups.has(s.groupId)) out.add(s.id);
    return [...out];
  }

  select(ids: ShapeId[]): void {
    this.store.setState({ selection: this.expandGroups(ids) });
  }

  selectNone(): void {
    if (this.state.selection.length) this.store.setState({ selection: [] });
  }

  selectAll(): void {
    this.select(this.getShapes().map((s) => s.id));
  }

  /** Select shapes fully inside the rect, or (except frames) whose centre is inside it. */
  selectInRect(rect: Rect, additive: ShapeId[] = []): void {
    const inside = (p: Vec) => p.x >= rect.x && p.y >= rect.y && p.x <= rect.x + rect.w && p.y <= rect.y + rect.h;
    const hits = this.getShapes().filter((s) => contains(rect, shapeBounds(s)) || (s.type !== "frame" && inside(center(s))));
    this.select([...additive, ...hits.map((s) => s.id)]);
  }

  private pruneSelection(): void {
    const { selection, doc } = this.state;
    const kept = selection.filter((id) => doc.shapes[id]);
    if (kept.length !== selection.length) this.store.setState({ selection: kept });
  }

  setTool(tool: ToolId): void {
    if (this.state.tool !== tool) this.store.setState({ tool, marquee: null, draft: null, erasing: [] });
  }

  setStyle(style: Partial<StrokeStyle>): void {
    this.store.setState({ style: { ...this.state.style, ...style } });
  }

  setTransient(patch: Partial<Pick<DeskState, "marquee" | "draft" | "erasing">>): void {
    this.store.setState(patch);
  }

  // ── camera ─────────────────────────────────────────────────────────────

  setViewport(rect: Rect): void {
    const v = this.state.viewport;
    if (v.x !== rect.x || v.y !== rect.y || v.w !== rect.w || v.h !== rect.h) this.store.setState({ viewport: rect });
  }

  setCamera(camera: Camera): void {
    this.stopAnimation();
    this.store.setState({ camera: { ...camera, z: clamp(camera.z, MIN_ZOOM, MAX_ZOOM) } });
  }

  panBy(dxScreen: number, dyScreen: number): void {
    const { camera } = this.state;
    this.setCamera({ ...camera, x: camera.x + dxScreen / camera.z, y: camera.y + dyScreen / camera.z });
  }

  /** Zoom keeping the page point under `screen` fixed. */
  zoomAt(screen: Vec, factor: number): void {
    const p = this.screenToPage(screen);
    const z = clamp(this.state.camera.z * factor, MIN_ZOOM, MAX_ZOOM);
    const { viewport } = this.state;
    this.setCamera({ x: (screen.x - viewport.x) / z - p.x, y: (screen.y - viewport.y) / z - p.y, z });
  }

  zoomIn(): void {
    this.zoomAt(this.viewportCenter(), 1.25);
  }

  zoomOut(): void {
    this.zoomAt(this.viewportCenter(), 0.8);
  }

  resetZoom(): void {
    this.zoomAt(this.viewportCenter(), 1 / this.state.camera.z);
  }

  private viewportCenter(): Vec {
    const v = this.state.viewport;
    return { x: v.x + v.w / 2, y: v.y + v.h / 2 };
  }

  cameraFor(bounds: Rect, inset = 80, targetZoom = MAX_ZOOM): Camera {
    const { viewport } = this.state;
    const z = clamp(Math.min((viewport.w - inset * 2) / Math.max(bounds.w, 1), (viewport.h - inset * 2) / Math.max(bounds.h, 1), targetZoom), MIN_ZOOM, MAX_ZOOM);
    return { x: viewport.w / 2 / z - (bounds.x + bounds.w / 2), y: viewport.h / 2 / z - (bounds.y + bounds.h / 2), z };
  }

  zoomToBounds(bounds: Rect, opts: { inset?: number; targetZoom?: number; animate?: boolean } = {}): void {
    const target = this.cameraFor(bounds, opts.inset, opts.targetZoom);
    if (opts.animate === false || typeof requestAnimationFrame === "undefined") this.setCamera(target);
    else this.animateTo(target);
  }

  zoomToFit(opts: { animate?: boolean } = {}): void {
    const bounds = union(this.getShapes().map(shapeBounds));
    if (bounds) this.zoomToBounds(bounds, { inset: 60, targetZoom: 1, animate: opts.animate });
  }

  zoomToSelection(): void {
    const bounds = this.selectionBounds();
    if (bounds) this.zoomToBounds(bounds, { inset: 120, targetZoom: 1.4 });
  }

  private animateTo(target: Camera): void {
    this.stopAnimation();
    const start = this.state.camera;
    const { viewport } = this.state;
    const cx = (c: Camera) => ({ x: viewport.w / 2 / c.z - c.x, y: viewport.h / 2 / c.z - c.y });
    const from = cx(start);
    const to = cx(target);
    const t0 = performance.now();
    const step = () => {
      // performance.now, not the rAF timestamp: they aren't guaranteed to share a clock
      const t = easeInOutCubic(Math.min(1, (performance.now() - t0) / CAMERA_MS));
      const z = Math.exp(Math.log(start.z) + (Math.log(target.z) - Math.log(start.z)) * t);
      const c = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      this.store.setState({ camera: { x: viewport.w / 2 / z - c.x, y: viewport.h / 2 / z - c.y, z } });
      this.animation = t < 1 ? requestAnimationFrame(step) : 0;
    };
    this.animation = requestAnimationFrame(step);
  }

  private stopAnimation(): void {
    if (this.animation) cancelAnimationFrame(this.animation);
    this.animation = 0;
  }

  // ── persistence and events ─────────────────────────────────────────────

  snapshot(): DeskDoc {
    return this.state.doc;
  }

  /** Replace the document without an undo step or change notification. */
  load(doc: DeskDoc): void {
    this.past = [];
    this.future = [];
    this.gesture = null;
    this.store.setState({ doc, selection: [], canUndo: false, canRedo: false });
  }

  onDocChange(listener: DocListener): () => void {
    this.docListeners.add(listener);
    return () => this.docListeners.delete(listener);
  }

  onBeforeDelete(listener: DeleteListener): () => void {
    this.deleteListeners.add(listener);
    return () => this.deleteListeners.delete(listener);
  }

  /** Marquee helper exposed for the gesture controller. */
  static rectFrom(a: Vec, b: Vec): Rect {
    return normalizeRect(a, b);
  }
}

export function isDeskDoc(value: unknown): value is DeskDoc {
  return Boolean(value && typeof value === "object" && (value as DeskDoc).version === 1 && typeof (value as DeskDoc).shapes === "object");
}
