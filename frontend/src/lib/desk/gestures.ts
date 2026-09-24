import { newId, type Desk } from "./desk";
import { center, normalizeRect } from "./math";
import { strokeFromPoints } from "./strokes";
import type { BoardShape, FrameShape, Shape, ShapeId, ToolId, Vec } from "./types";

export type Handle = "nw" | "ne" | "se" | "sw" | "rotate";
export type RegionToolId = "jev" | "paint" | "pick";

export interface PointerInfo {
  /** client coordinates */
  x: number;
  y: number;
  button?: number;
  shift?: boolean;
  alt?: boolean;
  mod?: boolean;
  pressure?: number;
  handle?: Handle | null;
}

export interface KeyInfo {
  key: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export interface GestureHooks {
  /** Jev / paint / pick tools clicked a board (page point) */
  onRegion(tool: RegionToolId, board: BoardShape, page: Vec): void;
  onHover(board: BoardShape | null, page: Vec): void;
  onOpenBoard(board: BoardShape): void;
}

type Mode =
  | { kind: "idle" }
  | { kind: "pan"; last: Vec }
  | { kind: "translate"; start: Vec; ids: ShapeId[]; origins: Map<ShapeId, Vec>; moved: boolean }
  | { kind: "marquee"; start: Vec; additive: ShapeId[] }
  | { kind: "scale"; anchor: Vec; startDist: number; originals: Shape[] }
  | { kind: "rotate"; pivot: Vec; startAngle: number; originals: Shape[] }
  | { kind: "draw"; points: [number, number, number][]; brush: boolean }
  | { kind: "erase"; hits: Set<ShapeId> }
  | { kind: "frame"; start: Vec };

const REGION_TOOLS = new Set<ToolId>(["jev", "paint", "pick"]);
const DRAG_THRESHOLD_PX = 3;
const SNAP = Math.PI / 12;
const TOOL_KEYS: Record<string, ToolId> = { v: "select", h: "hand", z: "zoom", d: "draw", e: "eraser", b: "paint", i: "pick", f: "frame", j: "jev" };

const firstBoard = (shapes: Shape[]) => shapes.find((s): s is BoardShape => s.type === "board" && !s.locked) ?? null;

/** Pointer + keyboard state machine for the desk. Framework-free, so it's testable. */
export class GestureController {
  mode: Mode = { kind: "idle" };
  space = false;

  constructor(
    private readonly desk: Desk,
    private readonly hooks: GestureHooks,
  ) {}

  private page(info: PointerInfo): Vec {
    return this.desk.screenToPage(info);
  }

  down(info: PointerInfo): void {
    const desk = this.desk;
    const tool = desk.state.tool;
    const p = this.page(info);

    if (info.button === 1 || this.space || tool === "hand" || !desk.state.interactive) {
      this.mode = { kind: "pan", last: { x: info.x, y: info.y } };
      return;
    }
    if (tool === "zoom") {
      desk.zoomAt(info, info.alt ? 0.8 : 1.25);
      return;
    }
    if (REGION_TOOLS.has(tool)) {
      const board = firstBoard(desk.shapesAt(p));
      if (board) this.hooks.onRegion(tool as RegionToolId, board, p);
      else desk.selectNone();
      return;
    }
    if (tool === "draw" || tool === "highlight") {
      this.mode = { kind: "draw", points: [[p.x, p.y, info.pressure ?? 0.5]], brush: tool === "highlight" };
      desk.setTransient({ draft: strokeFromPoints(this.mode.points, desk.state.style, tool === "highlight") });
      return;
    }
    if (tool === "eraser") {
      this.mode = { kind: "erase", hits: new Set() };
      this.erase(p);
      return;
    }
    if (tool === "frame") {
      this.mode = { kind: "frame", start: p };
      return;
    }

    // select tool
    if (info.handle) {
      const bounds = desk.selectionBounds();
      const originals = desk.getSelected().map((s) => structuredClone(s));
      if (!bounds || !originals.length) return;
      desk.beginGesture();
      if (info.handle === "rotate") {
        const pivot = center(bounds);
        this.mode = { kind: "rotate", pivot, startAngle: Math.atan2(p.y - pivot.y, p.x - pivot.x), originals };
      } else {
        const anchor = {
          nw: { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
          ne: { x: bounds.x, y: bounds.y + bounds.h },
          se: { x: bounds.x, y: bounds.y },
          sw: { x: bounds.x + bounds.w, y: bounds.y },
        }[info.handle];
        this.mode = { kind: "scale", anchor, startDist: Math.max(1, Math.hypot(p.x - anchor.x, p.y - anchor.y)), originals };
      }
      return;
    }
    const hit = desk.shapeAt(p);
    if (!hit) {
      if (!info.shift) desk.selectNone();
      this.mode = { kind: "marquee", start: p, additive: info.shift ? desk.state.selection : [] };
      return;
    }
    const selection = desk.state.selection;
    if (info.shift) {
      const group = desk.expandGroups([hit.id]);
      desk.select(selection.includes(hit.id) ? selection.filter((id) => !group.includes(id)) : [...selection, hit.id]);
    } else if (!selection.includes(hit.id)) desk.select([hit.id]);
    const ids = desk.getSelected().filter((s) => !s.locked).map((s) => s.id);
    if (!ids.length) return;
    desk.beginGesture();
    this.mode = { kind: "translate", start: p, ids, origins: new Map(ids.map((id) => [id, { x: desk.getShape(id)!.x, y: desk.getShape(id)!.y }])), moved: false };
  }

  move(info: PointerInfo): void {
    const desk = this.desk;
    const p = this.page(info);
    const mode = this.mode;
    switch (mode.kind) {
      case "idle":
        if (REGION_TOOLS.has(desk.state.tool)) this.hooks.onHover(firstBoard(desk.shapesAt(p)), p);
        return;
      case "pan":
        desk.panBy(info.x - mode.last.x, info.y - mode.last.y);
        mode.last = { x: info.x, y: info.y };
        return;
      case "translate": {
        const delta = { x: p.x - mode.start.x, y: p.y - mode.start.y };
        if (!mode.moved && Math.hypot(delta.x, delta.y) * desk.getZoom() < DRAG_THRESHOLD_PX) return;
        mode.moved = true;
        desk.translate(mode.ids, mode.origins, delta);
        return;
      }
      case "marquee": {
        const rect = normalizeRect(mode.start, p);
        desk.setTransient({ marquee: rect });
        desk.selectInRect(rect, mode.additive);
        return;
      }
      case "scale":
        desk.scale(mode.originals, mode.anchor, Math.hypot(p.x - mode.anchor.x, p.y - mode.anchor.y) / mode.startDist);
        return;
      case "rotate": {
        let delta = Math.atan2(p.y - mode.pivot.y, p.x - mode.pivot.x) - mode.startAngle;
        if (info.shift) delta = Math.round(delta / SNAP) * SNAP;
        desk.rotateBy(mode.originals, mode.pivot, delta);
        return;
      }
      case "draw": {
        const [lx, ly] = mode.points[mode.points.length - 1];
        if (Math.hypot(p.x - lx, p.y - ly) * desk.getZoom() < 1) return;
        mode.points.push([p.x, p.y, info.pressure ?? 0.5]);
        desk.setTransient({ draft: strokeFromPoints(mode.points, desk.state.style, mode.brush) });
        return;
      }
      case "erase":
        this.erase(p);
        return;
      case "frame": {
        const r = normalizeRect(mode.start, p);
        desk.setTransient({ draft: { id: "draft-frame", type: "frame", ...r, rotation: 0, z: 0, locked: false, groupId: null, title: "Frame" } });
        return;
      }
    }
  }

  up(info: PointerInfo): void {
    const desk = this.desk;
    const mode = this.mode;
    this.mode = { kind: "idle" };
    switch (mode.kind) {
      case "translate":
      case "scale":
      case "rotate":
        desk.endGesture();
        return;
      case "marquee":
        desk.setTransient({ marquee: null });
        return;
      case "draw":
        desk.setTransient({ draft: null });
        desk.createShape(strokeFromPoints(mode.points, desk.state.style, mode.brush));
        return;
      case "erase":
        desk.setTransient({ erasing: [] });
        desk.deleteShapes([...mode.hits]);
        return;
      case "frame": {
        desk.setTransient({ draft: null });
        const r = normalizeRect(mode.start, this.page(info));
        if (r.w * desk.getZoom() < 20 || r.h * desk.getZoom() < 20) return;
        const back = Math.min(0, ...desk.getShapes().map((s) => s.z)) - 1;
        const frame = desk.createShape<FrameShape>({ id: newId("frame"), type: "frame", ...r, z: back, title: `Frame ${desk.getShapes().filter((s) => s.type === "frame").length + 1}` });
        desk.setTool("select");
        desk.select([frame.id]);
        return;
      }
    }
  }

  cancel(): void {
    const kind = this.mode.kind;
    if (kind === "translate" || kind === "scale" || kind === "rotate") this.desk.endGesture();
    this.desk.setTransient({ marquee: null, draft: null, erasing: [] });
    this.mode = { kind: "idle" };
  }

  /** Trackpads send small deltas, mouse wheels ~100 per notch: clamp so one notch is ~1.5×. */
  wheel(info: PointerInfo & { dx: number; dy: number }): void {
    if (info.mod) this.desk.zoomAt(info, Math.exp(-Math.max(-40, Math.min(40, info.dy)) * 0.01));
    else this.desk.panBy(-info.dx, -info.dy);
  }

  doubleClick(info: PointerInfo): void {
    const board = firstBoard(this.desk.shapesAt(this.page(info)));
    if (board && this.desk.state.tool === "select" && this.desk.state.interactive) this.hooks.onOpenBoard(board);
  }

  private erase(p: Vec): void {
    if (this.mode.kind !== "erase") return;
    for (const s of this.desk.shapesAt(p, 6)) if (s.type === "stroke" && !s.locked) this.mode.hits.add(s.id);
    this.desk.setTransient({ erasing: [...this.mode.hits] });
  }

  /** Returns true when the key was handled. */
  keyDown(k: KeyInfo): boolean {
    const desk = this.desk;
    const key = k.key.toLowerCase();
    const selection = desk.state.selection;
    if (key === " ") {
      this.space = true;
      return true;
    }
    if (!desk.state.interactive) return false;
    if (k.mod) {
      if (key === "z" && k.shift) desk.redo();
      else if (key === "z") desk.undo();
      else if (key === "y") desk.redo();
      else if (key === "d") desk.duplicate(selection);
      else if (key === "g" && k.shift) desk.ungroup(selection);
      else if (key === "g") desk.group(selection);
      else if (key === "a") desk.selectAll();
      else if (key === "0") desk.resetZoom();
      else return false;
      return true;
    }
    if (key === "escape") {
      if (desk.state.tool !== "select") desk.setTool("select");
      else desk.selectNone();
      return true;
    }
    if (key === "delete" || key === "backspace") {
      desk.deleteShapes(selection);
      return true;
    }
    if (k.key.startsWith("Arrow") && selection.length) {
      const step = k.shift ? 10 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[k.key]!;
      desk.translate(selection, new Map(selection.map((id) => [id, desk.getShape(id)!])), { x: d[0], y: d[1] });
      return true;
    }
    if (k.shift && (key === "1" || key === "!")) return (desk.zoomToFit(), true);
    if (k.shift && (key === "2" || key === "@")) return (desk.zoomToSelection(), true);
    if (k.shift && key === "l") return (desk.toggleLock(selection), true);
    if (k.shift && key === "d") return (desk.setTool("highlight"), true);
    if (key === "]") return (desk.bringToFront(selection), true);
    if (key === "[") return (desk.sendToBack(selection), true);
    if (key === "=" || key === "+") return (desk.zoomIn(), true);
    if (key === "-") return (desk.zoomOut(), true);
    const tool = TOOL_KEYS[key];
    if (tool && !k.shift && !k.alt) {
      desk.setTool(tool);
      return true;
    }
    return false;
  }

  keyUp(k: KeyInfo): void {
    if (k.key === " ") this.space = false;
  }
}
