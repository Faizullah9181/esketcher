import { createBoard } from "@/lib/canvas/boards";
import { Desk } from "@/lib/desk/desk";
import type { BoardShape } from "@/lib/desk/types";
import { initialStudio, useStudio } from "@/state/studio";
import { MATERIALS, sketch } from "@/test/fixtures";

/** A real desk with `count` Watcher boards, installed in the studio store. */
export function setupDesk(count = 1): { desk: Desk; ids: string[] } {
  const desk = new Desk();
  desk.setViewport({ x: 0, y: 0, w: 1200, h: 800 });
  const ids = Array.from({ length: count }, (_, i) => createBoard(desk, sketch({ title: `Board ${i + 1}` }), { x: i * 400, y: 0 }));
  desk.load(desk.snapshot());
  useStudio.setState({ ...initialStudio, desk });
  useStudio.getState().setCatalog(MATERIALS, [sketch(), sketch({ id: "sk-002", title: "Koi", category: "animals", tags: ["fish"] })]);
  return { desk, ids };
}

export const boardOf = (desk: Desk, id: string) => desk.getShape<BoardShape>(id)!;
