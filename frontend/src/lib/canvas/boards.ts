import { newId, type Desk } from "@/lib/desk/desk";
import { shapeBounds, union } from "@/lib/desk/math";
import type { BoardShape, Shape, SketchBoardProps } from "@/lib/desk/types";
import type { Pt } from "@/lib/geometry";
import { createRng } from "@/lib/rng";
import { ART_H, ART_W, generateSketch, type Region, type SketchArt } from "@/lib/sketchArt";
import type { Material, Paint, SketchAsset, SketchCategory } from "@/types";

export const BOARD_W = 320;
export const BOARD_H = 400;
const GAP_X = 70;
const GAP_Y = 90;

export function isBoard(shape: Shape | undefined | null): shape is BoardShape {
  return Boolean(shape && shape.type === "board");
}

export function boardArt(board: Pick<BoardShape, "props"> | { props: SketchBoardProps }): SketchArt {
  const { category, variant, seed, complexity } = board.props;
  return generateSketch({ category: category as SketchCategory, variant, seed, complexity });
}

export function findRegion(board: BoardShape, regionId: string | null): Region | null {
  return regionId ? (boardArt(board).regions.find((r) => r.id === regionId) ?? null) : null;
}

export function listBoards(desk: Desk): BoardShape[] {
  return desk.getShapes().filter(isBoard);
}

export function artToPage(desk: Desk, board: BoardShape, [x, y]: Pt) {
  return desk.localToPage(board.id, { x: (x * board.w) / ART_W, y: (y * board.h) / ART_H });
}

export function pageToArt(desk: Desk, board: BoardShape, point: { x: number; y: number }): Pt {
  const local = desk.pageToLocal(board.id, point);
  return [(local.x * ART_W) / board.w, (local.y * ART_H) / board.h];
}

/** Where on screen a region (or the whole board) sits, for paint flights. */
export function regionScreenPoint(desk: Desk, board: BoardShape, region: Region | null) {
  const art: Pt = region ? region.centroid : [ART_W / 2, ART_H / 2];
  return desk.pageToScreen(artToPage(desk, board, art));
}

/** Apply materials to regions as one undoable step. */
export function applyPaints(desk: Desk, boardId: string, assignments: Record<string, string>, decisionId?: string): void {
  const board = desk.getShape(boardId);
  if (!isBoard(board)) return;
  const now = Date.now();
  const paints: Record<string, Paint> = { ...board.props.paints };
  Object.entries(assignments).forEach(([regionId, materialId], i) => {
    // stagger so a whole-sketch treatment cascades instead of popping at once
    paints[regionId] = decisionId ? { m: materialId, t: now + i * 90, d: decisionId } : { m: materialId, t: now + i * 90 };
  });
  desk.updateShape<BoardShape>(boardId, { props: { ...board.props, paints } });
}

export function setLockedMaterial(desk: Desk, boardId: string, materialId: string | null): void {
  const board = desk.getShape(boardId);
  if (!isBoard(board)) return;
  desk.updateShape<BoardShape>(boardId, { props: { ...board.props, lockedMaterial: materialId } });
}

const PHONE_W = 640;
const SHORT_H = 420;

/** Opening view: the whole desk, or on phones the first two boards so sketches are legible. */
export function zoomToStart(desk: Desk): void {
  const boards = listBoards(desk).sort((a, b) => a.props.num - b.props.num);
  const { w, h } = desk.state.viewport;
  if ((w < PHONE_W || h < SHORT_H) && boards.length > 1) {
    const first = union(boards.slice(0, 2).map(shapeBounds));
    if (first) return desk.zoomToBounds(first, { inset: 16, targetZoom: 1, animate: false });
  }
  desk.zoomToFit({ animate: false });
}

export function focusBoard(desk: Desk, boardId: string): void {
  const board = desk.getShape(boardId);
  if (!board) return;
  desk.select([boardId]);
  desk.zoomToBounds(shapeBounds(board), { inset: 140, targetZoom: 1.4 });
}

function nextNumber(desk: Desk): number {
  return listBoards(desk).reduce((max, b) => Math.max(max, b.props.num), 0) + 1;
}

/** A free spot on the desk: right of the last board, wrapping into rows. */
export function freeSpot(desk: Desk): { x: number; y: number } {
  const boards = listBoards(desk);
  if (!boards.length) {
    const v = desk.getViewportPageBounds();
    return { x: v.x + v.w / 2 - BOARD_W / 2, y: v.y + v.h / 2 - BOARD_H / 2 };
  }
  const count = boards.length;
  const minX = Math.min(...boards.map((b) => b.x));
  const minY = Math.min(...boards.map((b) => b.y));
  return { x: minX + (count % 4) * (BOARD_W + GAP_X), y: minY + Math.floor(count / 4) * (BOARD_H + GAP_Y) };
}

export function createBoard(desk: Desk, sketch: SketchAsset, at?: { x: number; y: number }, extra: { paints?: Record<string, Paint>; rotation?: number } = {}): string {
  const spot = at ?? freeSpot(desk);
  return desk.createShape<BoardShape>({
    id: newId("board"),
    type: "board",
    x: spot.x,
    y: spot.y,
    w: BOARD_W,
    h: BOARD_H,
    rotation: extra.rotation ?? 0,
    props: {
      num: nextNumber(desk),
      sketchId: sketch.id,
      title: sketch.title,
      category: sketch.category,
      variant: sketch.variant,
      seed: sketch.seed,
      complexity: sketch.complexity,
      paints: extra.paints ?? {},
      lockedMaterial: null,
      palette: null,
    },
  }).id;
}

const STARTER_CATEGORIES: SketchCategory[] = ["eyes", "flowers", "mechanical", "faces", "planets", "insects", "typography", "architecture", "creatures", "masks", "botanical", "landscapes"];

/**
 * The first desk: twelve varied sketches, a few already part-painted so the
 * studio looks lived-in. These paints are starter content, not Jev decisions,
 * and they never appear in decision history.
 */
export function seedDesk(desk: Desk, sketches: SketchAsset[], materials: Material[]): void {
  if (!sketches.length || desk.getShapes().length) return;
  const rng = createRng(20260923);
  const picks = STARTER_CATEGORIES.map((category, i) => sketches.filter((s) => s.category === category)[i % 5]).filter(Boolean);
  desk.transact(() => {
    picks.forEach((sketch, i) => {
      const art = generateSketch(sketch);
      const paints: Record<string, Paint> = {};
      if (materials.length && i % 3 === 0) {
        const regions = art.regions.filter((r) => r.kind !== "sky");
        for (const region of regions.filter((r) => r.focal || rng.chance(0.3)).slice(0, 4)) paints[region.id] = { m: rng.pick(materials).id, t: 0 };
      }
      createBoard(
        desk,
        sketch,
        { x: (i % 4) * (BOARD_W + GAP_X) + rng.range(-14, 14), y: Math.floor(i / 4) * (BOARD_H + GAP_Y) + rng.range(-18, 18) },
        { paints, rotation: rng.range(-0.035, 0.035) },
      );
    });
  });
  desk.load(desk.snapshot()); // the starting desk is not an undo step
  zoomToStart(desk);
}
