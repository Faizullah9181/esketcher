import { boardArt, pageToArt } from "@/lib/canvas/boards";
import { regionAtPoint } from "@/lib/canvas/hitTest";
import type { RegionToolId } from "@/lib/desk/gestures";
import type { BoardShape, Vec } from "@/lib/desk/types";
import { OFFLINE } from "@/services/api";

import { applyManual, requestDecision } from "./jevController";
import { useStudio } from "./studio";

export function regionUnder(board: BoardShape, page: Vec): string | null {
  const desk = useStudio.getState().desk;
  if (!desk) return null;
  return regionAtPoint(boardArt(board), pageToArt(desk, board, page))?.id ?? null;
}

export function hoverRegion(board: BoardShape | null, page: Vec): void {
  useStudio.getState().setHover(board ? { boardId: board.id, regionId: regionUnder(board, page) } : null);
}

/** Jev: decide and paint (the paint tool when Jev is offline). Paint: apply the armed material. Pick: arm the material under the cursor. */
export function actOnRegion(tool: RegionToolId, board: BoardShape, page: Vec): void {
  const store = useStudio.getState();
  const desk = store.desk;
  if (!desk) return;
  const regionId = regionUnder(board, page);
  desk.select([board.id]);
  store.setFocus({ boardId: board.id, regionId });
  if (tool === "jev" && !OFFLINE) {
    void requestDecision({ boardId: board.id, regionId, autoApply: true });
  } else if (tool === "paint" || tool === "jev") {
    if (store.armedMaterial) applyManual(store.armedMaterial, { boardId: board.id, regionId });
    else store.setDrawer("materials");
  } else {
    const paint = regionId ? board.props.paints[regionId] : undefined;
    if (!paint) return;
    store.arm(paint.m);
    desk.setTool("paint");
  }
}
