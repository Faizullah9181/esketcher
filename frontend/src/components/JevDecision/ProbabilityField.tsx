import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useState } from "react";

import { MaterialSwatch } from "@/lib/paintEngine/MaterialSwatch";
import type { Certainty, Decision, Material } from "@/types";

const VISIBLE = 6;
const TONE: Record<Certainty, { label: string; color: string }> = {
  confident: { label: "decisive field", color: "var(--color-jev)" },
  leaning: { label: "leaning field", color: "var(--color-bone)" },
  uncertain: { label: "uncertain field", color: "var(--color-warn)" },
};

function Percent({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${Math.round(v * 100)}%`);
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.7, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span className="es-mono w-10 text-right text-[11px] tabular-nums">{text}</motion.span>;
}

interface ProbabilityFieldProps {
  decision: Decision;
  materials: Map<string, Material>;
  onPick?: (materialId: string) => void;
}

/** Jev's distribution, drawn like an instrument readout. Every number is from the response. */
export function ProbabilityField({ decision, materials, onPick }: ProbabilityFieldProps) {
  const [expanded, setExpanded] = useState(false);
  const tone = TONE[decision.certainty];
  const rows = expanded ? decision.ranking : decision.ranking.slice(0, VISIBLE);
  const rest = decision.ranking.length - VISIBLE;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="es-label" style={{ color: tone.color }}>
          {tone.label}
        </span>
        <span className="es-mono text-[10px] text-ash">
          {decision.latencyMs}ms · {decision.model}
        </span>
      </div>

      {/* the whole field at a glance: segments sized by probability */}
      <div className="mt-3 flex h-2 w-full gap-px overflow-hidden" aria-hidden>
        {decision.ranking.map((r) => {
          const m = materials.get(r.materialId);
          return (
            <motion.div
              key={r.materialId}
              initial={{ flexGrow: 0.0001 }}
              animate={{ flexGrow: Math.max(r.probability, 0.004) }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
              style={{ background: m?.palette[0] ?? "#555", flexBasis: 0 }}
            />
          );
        })}
      </div>

      <ol className="mt-4 space-y-2.5">
        {rows.map((r, i) => {
          const m = materials.get(r.materialId);
          const winner = i === 0;
          return (
            <motion.li key={r.materialId} layout initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
              <button
                className={`es-focus group grid w-full grid-cols-[18px_1fr_40px] items-center gap-x-2.5 text-left ${onPick ? "cursor-pointer" : "cursor-default"}`}
                onClick={() => onPick?.(r.materialId)}
                disabled={!onPick}
                title={onPick ? `Apply ${m?.name ?? r.materialId} instead` : undefined}
              >
                <span className="h-[18px] w-[18px]">{m && <MaterialSwatch material={m} slot={`pf-${i}`} />}</span>
                <span className="min-w-0">
                  <span className={`block truncate text-[12px] uppercase tracking-[0.06em] ${winner ? "text-bone" : "text-bone/65 group-hover:text-bone"}`}>
                    {m?.name ?? r.materialId}
                  </span>
                  <span className="es-field-bar mt-1 block">
                    <motion.span
                      className="es-field-bar__fill"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: r.probability }}
                      transition={{ type: "spring", stiffness: 140, damping: 18, delay: i * 0.03 }}
                      style={{ width: "100%", background: m ? `linear-gradient(90deg, ${m.palette[2]}, ${m.palette[0]} 60%, ${m.palette[1]})` : "#777" }}
                    />
                  </span>
                </span>
                <Percent value={r.probability} />
              </button>
            </motion.li>
          );
        })}
      </ol>
      {rest > 0 && (
        <button className="es-focus es-mono mt-3 text-[10px] uppercase tracking-[0.14em] text-ash hover:text-bone" onClick={() => setExpanded(!expanded)}>
          {expanded ? "collapse field" : `+ ${rest} more in field`}
        </button>
      )}

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <span className="es-label">confidence</span>
          <span className="es-mono text-[11px]" style={{ color: tone.color }}>
            {decision.confidence.toFixed(2)}
          </span>
        </div>
        <div className="relative mt-2 h-[3px] bg-bone/10">
          <div className="absolute inset-y-0 left-[35%] w-px bg-bone/30" title="uncertain below" />
          <div className="absolute inset-y-0 left-[55%] w-px bg-bone/30" title="confident above" />
          <motion.div className="absolute -top-[3px] h-[9px] w-[2px]" style={{ background: tone.color, boxShadow: `0 0 8px ${tone.color}` }} initial={{ left: "0%" }} animate={{ left: `${decision.confidence * 100}%` }} transition={{ type: "spring", stiffness: 90, damping: 16 }} />
        </div>
      </div>
      {decision.treatment && (
        <div className="mt-4 flex items-baseline justify-between border-t es-hairline pt-3">
          <span className="es-label">treatment</span>
          <span className="es-mono text-[11px] uppercase">
            {decision.treatment.mode} <span className="text-ash">{Math.round((decision.treatment.probabilities[decision.treatment.mode] ?? 0) * 100)}%</span>
          </span>
        </div>
      )}
    </div>
  );
}
