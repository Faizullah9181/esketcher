import { motion } from "motion/react";
import { Search, X } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { useFilteredSketches, useSketches } from "@/hooks/useSketches";
import { createBoard, focusBoard } from "@/lib/canvas/boards";
import { useStudio } from "@/state/studio";
import type { SketchAsset, SketchCategory } from "@/types";

import { SketchThumb } from "./SketchThumb";

const COLS = 3;
const ROW_H = 196;
const OVERSCAN = 2;

/** Windowed grid: only the rows in view are mounted. */
function useWindow(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 4 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const start = Math.max(0, Math.floor(el.scrollTop / ROW_H) - OVERSCAN);
      const end = Math.min(Math.ceil(count / COLS), Math.ceil((el.scrollTop + el.clientHeight) / ROW_H) + OVERSCAN);
      setRange((r) => (r.start === start && r.end === end ? r : { start, end }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [count]);
  return { ref, range };
}

export function SketchGallery() {
  const all = useSketches();
  const setDrawer = useStudio((s) => s.setDrawer);
  const [category, setCategory] = useState<SketchCategory | "all">("all");
  const [query, setQuery] = useState("");
  const sketches = useFilteredSketches(category, query);
  const categories = useMemo(() => [...new Set(all.map((s) => s.category))], [all]);
  const { ref, range } = useWindow(sketches.length);

  const place = (sketch: SketchAsset) => {
    const desk = useStudio.getState().desk;
    if (!desk) return;
    const id = createBoard(desk, sketch);
    focusBoard(desk, id);
  };

  return (
    <motion.section
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="es-surface absolute inset-y-3 left-3 z-[400] flex w-[min(420px,calc(100%-24px))] flex-col border es-hairline"
      aria-label="Sketch library"
    >
      <div className="flex items-center justify-between border-b es-hairline px-4 py-3">
        <div>
          <div className="es-label !text-bone">Sketches</div>
          <div className="es-mono text-[10px] text-ash">
            {sketches.length} / {all.length} procedural line drawings
          </div>
        </div>
        <button className="es-focus text-ash hover:text-bone" onClick={() => setDrawer("sketches")} aria-label="Close library">
          <X size={16} />
        </button>
      </div>
      <div className="space-y-3 border-b es-hairline px-4 py-3">
        <label className="flex items-center gap-2 border es-hairline px-2">
          <Search size={13} className="text-ash" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search title or tag" className="h-8 flex-1 bg-transparent text-[13px] outline-none placeholder:text-dim" />
        </label>
        <div className="es-scroll flex gap-1 overflow-x-auto pb-1">
          {(["all", ...categories] as const).map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`es-focus es-mono shrink-0 border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${category === c ? "border-jev text-jev" : "es-hairline text-ash hover:text-bone"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div ref={ref} className="es-scroll relative flex-1 overflow-y-auto">
        <div style={{ height: Math.ceil(sketches.length / COLS) * ROW_H }}>
          {sketches.slice(range.start * COLS, range.end * COLS).map((s, i) => {
            const index = range.start * COLS + i;
            return (
              <button
                key={s.id}
                onClick={() => place(s)}
                className="es-focus group absolute p-2 text-left"
                style={{ top: Math.floor(index / COLS) * ROW_H, left: `${(index % COLS) * (100 / COLS)}%`, width: `${100 / COLS}%`, height: ROW_H }}
                title={`Add “${s.title}” to the desk`}
              >
                <div className="aspect-[4/5] overflow-hidden border es-hairline transition-[border-color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-jev/60">
                  <SketchThumb sketch={s} />
                </div>
                <div className="mt-1.5 truncate text-[11px]">{s.title}</div>
                <div className="es-mono flex justify-between text-[9px] uppercase tracking-[0.1em] text-ash">
                  <span>{s.category}</span>
                  <span>{s.complexity.toFixed(2)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
