import { motion } from "motion/react";

import { createBoard } from "@/lib/canvas/boards";
import { createRng } from "@/lib/rng";
import { OFFLINE } from "@/services/api";
import { requestDecision } from "@/state/jevController";
import { useStudio } from "@/state/studio";

/** Nothing on the desk: an invitation, not a welcome screen. */
export function EmptyState() {
  const setDrawer = useStudio((s) => s.setDrawer);
  const materials = useStudio((s) => s.materials);

  const letJevChoose = () => {
    const { desk, sketches } = useStudio.getState();
    if (!desk || !sketches.length) return;
    const sketch = createRng(Date.now()).pick(sketches);
    const id = createBoard(desk, sketch);
    desk.select([id]);
    desk.zoomToSelection();
    if (!OFFLINE) setTimeout(() => void requestDecision({ boardId: id, regionId: null, autoApply: true }), 700);
  };

  const field = materials.slice(0, 18);
  return (
    <div className="pointer-events-none absolute inset-0 z-[300] grid place-items-center overflow-hidden">
      <div aria-hidden className="absolute inset-0">
        {field.map((m, i) => (
          <motion.div
            key={m.id}
            className="absolute rounded-full blur-2xl"
            style={{ width: 140 + (i % 4) * 40, height: 140 + (i % 4) * 40, background: m.palette[0], left: `${(i * 37) % 90}%`, top: `${(i * 53) % 85}%`, opacity: 0.11 }}
            animate={{ x: [0, (i % 2 ? 1 : -1) * 40, 0], y: [0, (i % 3 ? -1 : 1) * 30, 0] }}
            transition={{ duration: 12 + (i % 5) * 2, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-auto relative max-w-md px-6 text-left"
      >
        <div className="es-label">Canvas · 0 sketches</div>
        <h2 className="mt-4 text-[44px] font-medium leading-[0.95] tracking-[-0.04em]">Your canvas is empty.</h2>
        <p className="mt-3 text-[44px] font-medium leading-[0.95] tracking-[-0.04em] text-jev">Good.</p>
        <p className="mt-6 text-[15px] leading-relaxed text-bone/70">
          Drag a material in. Draw something.
          <br />
          {OFFLINE ? "Or pick a random sketch." : "Or let Jev choose."}
        </p>
        <div className="mt-8 flex gap-2">
          <button className="es-btn es-btn--jev" onClick={() => setDrawer("sketches")}>
            Create sketch
          </button>
          <button className="es-btn" onClick={letJevChoose}>
            {OFFLINE ? "Random sketch" : "Let Jev choose"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
