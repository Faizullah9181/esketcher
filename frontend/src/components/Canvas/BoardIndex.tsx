import { ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";

import { useDeskValue } from "@/hooks/useDesk";

import { focusBoard, isBoard } from "@/lib/canvas/boards";
import { useStudio } from "@/state/studio";

const STATE_COLOR: Record<string, string> = {
  analyzing: "bg-jev animate-pulse",
  "decision-ready": "bg-jev",
  painting: "bg-bone animate-pulse",
};

/** The desk's table of contents: 01 PORTRAIT, 02 FLOWER … */
export function BoardIndex() {
  const desk = useStudio((s) => s.desk);
  const doc = useDeskValue((s) => s.doc);
  const [open, setOpen] = useState(false);
  const boards = useMemo(
    () =>
      Object.values(doc.shapes)
        .filter(isBoard)
        .map((b) => ({ id: b.id, num: b.props.num, title: b.props.title, category: b.props.category, painted: Object.keys(b.props.paints).length }))
        .sort((a, b) => a.num - b.num),
    [doc],
  );
  const states = useStudio((s) => s.boardState);
  const focus = useStudio((s) => s.focus?.boardId);
  if (!desk || !boards.length) return null;

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-[300] w-[228px] max-sm:hidden [@media(max-height:520px)]:hidden">
      {open && (
        <ol className="es-scroll es-surface mb-1 max-h-[46vh] overflow-y-auto border es-hairline py-1">
          {boards.map((b) => (
            <li key={b.id}>
              <button
                onClick={() => focusBoard(desk, b.id)}
                className={`es-focus flex w-full items-center gap-3 px-3 py-1.5 text-left transition-colors hover:bg-bone/[0.05] ${focus === b.id ? "bg-bone/[0.06]" : ""}`}
              >
                <span className="es-mono w-5 text-[10px] text-ash">{String(b.num).padStart(2, "0")}</span>
                <span className="flex-1 truncate text-[12px] uppercase tracking-[0.06em]">{b.category}</span>
                <span className={`es-dot ${STATE_COLOR[states[b.id] ?? ""] ?? (b.painted ? "bg-bone/50" : "bg-bone/10")}`} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <button onClick={() => setOpen(!open)} className="es-focus es-surface flex w-full items-center gap-3 border es-hairline px-3 py-2 text-left">
        <span className="es-label !text-bone">Desk</span>
        <span className="es-mono text-[10px] text-ash">
          {boards.length} sketches · {boards.filter((b) => b.painted).length} painted
        </span>
        <ChevronUp size={13} className={`ml-auto text-ash transition-transform ${open ? "" : "rotate-180"}`} />
      </button>
    </div>
  );
}
