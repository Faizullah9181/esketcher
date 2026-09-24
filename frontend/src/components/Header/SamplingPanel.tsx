import { motion } from "motion/react";
import { Play, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";

import { OFFLINE_MESSAGE } from "@/services/api";
import { SAMPLE_MAX, SAMPLE_MIN, buildSampling, playSampling, rewindSampling, stopSampling } from "@/state/sampling";
import { useStudio } from "@/state/studio";
import type { SketchCategory } from "@/types";

const PRESETS = [4, 7, 12, 24, 50];

/** Set how many samples to run, build the carousel, play it. */
export function SamplingPanel() {
  const sketches = useStudio((s) => s.sketches);
  const run = useStudio((s) => s.sampling);
  const sim = useStudio((s) => s.sim.status);
  const offline = useStudio((s) => s.offline);
  const setDrawer = useStudio((s) => s.setDrawer);
  const [count, setCount] = useState(run?.ids.length ?? 7);
  const [category, setCategory] = useState<SketchCategory | "mixed">("mixed");
  const categories = useMemo(() => [...new Set(sketches.map((s) => s.category))], [sketches]);
  const decisions = "~" + Math.round(count * 4.5);

  const build = () => buildSampling(count, category);
  const play = () => {
    useStudio.setState({ drawer: "none" }); // get out of the carousel's way
    void playSampling();
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="es-surface absolute left-3 top-3 z-[400] w-[min(380px,calc(100%-24px))] border es-hairline"
      aria-label="Sampling"
    >
      <div className="flex items-center justify-between border-b es-hairline px-4 py-3">
        <div>
          <div className="es-label !text-bone">Sampling</div>
          <div className="es-mono text-[10px] text-ash">a carousel of samples; Jev paints them one by one</div>
        </div>
        <button className="es-focus text-ash hover:text-bone" onClick={() => setDrawer("sampling")} aria-label="Close sampling">
          <X size={16} />
        </button>
      </div>
      <div className="space-y-5 px-4 py-4">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="es-label">samples</span>
            <span className="es-mono text-[22px] tabular-nums">{count}</span>
          </div>
          <input type="range" min={SAMPLE_MIN} max={SAMPLE_MAX} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-jev)]" aria-label="Number of samples" />
          <div className="mt-2 flex gap-1">
            {PRESETS.map((n) => (
              <button key={n} onClick={() => setCount(n)} className={`es-focus es-mono flex-1 border py-1 text-[11px] ${count === n ? "border-jev text-jev" : "es-hairline text-ash hover:text-bone"}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="es-label mb-2">sketches</div>
          <select value={category} onChange={(e) => setCategory(e.target.value as SketchCategory | "mixed")} className="es-focus w-full border es-hairline bg-slab px-2 py-2 text-[13px]" aria-label="Sample category">
            <option value="mixed">Mixed: one of every kind</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <p className="es-mono text-[10px] leading-relaxed text-dim">
          Replaces the desk with {count} samples (⌘Z restores it). {offline ? OFFLINE_MESSAGE : `A run makes ${decisions} Jev decisions.`}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button className="es-btn" onClick={build} disabled={sim === "running"}>
            {run ? "Rebuild" : "Build carousel"}
          </button>
          <button className="es-btn es-btn--jev" onClick={run ? play : () => (build(), play())} disabled={offline || sim === "running"} title={offline ? OFFLINE_MESSAGE : undefined}>
            <Play size={13} className="fill-current" /> Play
          </button>
        </div>
        {run && (
          <div className="flex items-center justify-between border-t es-hairline pt-3">
            <span className="es-mono text-[11px] text-ash">
              {run.cursor}/{run.ids.length} painted
            </span>
            <span className="flex gap-2">
              <button className="es-btn !h-8 !px-3" onClick={rewindSampling} disabled={sim === "running"} title="Back to the first sample">
                <RotateCcw size={12} />
              </button>
              <button className="es-btn !h-8 !px-3" onClick={stopSampling} title="Keep the boards, drop the carousel">
                Dissolve
              </button>
            </span>
          </div>
        )}
      </div>
    </motion.section>
  );
}
