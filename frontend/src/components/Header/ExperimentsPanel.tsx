import { motion } from "motion/react";
import { X } from "lucide-react";

import { useStudio } from "@/state/studio";
import type { Certainty } from "@/types";

const THRESHOLDS: { id: Certainty; label: string }[] = [
  { id: "confident", label: "only when confident" },
  { id: "leaning", label: "when leaning or better" },
  { id: "uncertain", label: "always" },
];

export function ExperimentsPanel() {
  const chaos = useStudio((s) => s.chaos);
  const toggleChaos = useStudio((s) => s.toggleChaos);
  const count = useStudio((s) => s.candidateCount);
  const setCount = useStudio((s) => s.setCandidateCount);
  const autoApplyMin = useStudio((s) => s.autoApplyMin);
  const setAutoApplyMin = useStudio((s) => s.setAutoApplyMin);
  const setDrawer = useStudio((s) => s.setDrawer);

  return (
    <motion.section
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="es-surface absolute left-3 top-3 z-[400] w-[min(360px,calc(100%-24px))] border es-hairline"
      aria-label="Experiments"
    >
      <div className="flex items-center justify-between border-b es-hairline px-4 py-3">
        <span className="es-label !text-bone">Experiments</span>
        <button className="es-focus text-ash hover:text-bone" onClick={() => setDrawer("experiments")} aria-label="Close experiments">
          <X size={16} />
        </button>
      </div>
      <div className="space-y-5 px-4 py-4">
        <button onClick={toggleChaos} className={`es-focus flex w-full items-center justify-between border px-4 py-3 text-left transition-colors ${chaos ? "border-jev bg-jev/10" : "es-hairline hover:border-bone/30"}`} aria-pressed={chaos}>
          <span>
            <span className="block text-[15px] font-medium tracking-tight">Chaos mode</span>
            <span className="es-mono block text-[10px] text-ash">faster stream · wider fields · Jev paints on its own</span>
          </span>
          <span className={`es-mono text-[11px] ${chaos ? "text-jev" : "text-ash"}`}>{chaos ? "ON" : "OFF"}</span>
        </button>
        <div>
          <div className="flex justify-between">
            <span className="es-label">candidate field size</span>
            <span className="es-mono text-[11px]">{count}</span>
          </div>
          <input type="range" min={2} max={16} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-jev)]" aria-label="Candidate field size" />
        </div>
        <div>
          <div className="es-label mb-2">Jev tool paints automatically</div>
          <div className="space-y-1">
            {THRESHOLDS.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 text-[12px]">
                <input type="radio" name="threshold" checked={autoApplyMin === t.id} onChange={() => setAutoApplyMin(t.id)} className="accent-[var(--color-jev)]" />
                {t.label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
