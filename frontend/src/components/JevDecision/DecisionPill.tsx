import { ChevronUp } from "lucide-react";

import { JevGlyph } from "@/components/common/JevGlyph";
import { applyActive } from "@/state/jevController";
import { useStudio } from "@/state/studio";

/** Phones and tablets: the panel is a slide-over, so surface Jev's answer as a pill. */
export function DecisionPill() {
  const active = useStudio((s) => s.active);
  const open = useStudio((s) => s.panelOpen);
  const sim = useStudio((s) => s.sim.status);
  const material = useStudio((s) => (s.active?.decision ? s.materialsById.get(s.active.decision.selectedMaterial) : undefined));
  const setOpen = useStudio((s) => s.setPanelOpen);
  if (open || !active || sim === "running") return null;
  const thinking = active.status === "analyzing";
  const decision = active.decision;
  return (
    <div className="es-surface pointer-events-auto absolute bottom-3 left-1/2 z-[320] flex w-[min(420px,calc(100%-24px))] -translate-x-1/2 items-center gap-3 border es-hairline py-2 pl-3 pr-2 lg:hidden max-sm:bottom-[64px]" role="status" aria-live="polite">
      <JevGlyph size={18} active={!thinking} />
      <button className="es-focus min-w-0 flex-1 text-left" onClick={() => setOpen(true)} aria-label="Show Jev's field">
        {thinking ? (
          <span className="es-label !text-bone">evaluating material field…</span>
        ) : active.status === "error" ? (
          <span className="es-label !text-warn">jev interrupted · tap for options</span>
        ) : decision && material ? (
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: material.palette[0] }} />
            <span className="truncate text-[13px] uppercase tracking-[0.04em]">{material.name}</span>
            <span className={`es-mono text-[11px] ${decision.certainty === "uncertain" ? "text-warn" : "text-ash"}`}>{Math.round(decision.ranking[0].probability * 100)}%</span>
          </span>
        ) : null}
      </button>
      {decision && active.status === "ready" && (
        <button className="es-btn es-btn--jev !h-8 !px-3" onClick={() => applyActive()}>
          Apply
        </button>
      )}
      <button className="es-focus grid h-8 w-8 place-items-center text-ash" onClick={() => setOpen(true)} aria-label="Open Jev panel">
        <ChevronUp size={16} />
      </button>
    </div>
  );
}
