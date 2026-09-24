import { motion } from "motion/react";

import { JevGlyph } from "@/components/common/JevGlyph";
import { MaterialSwatch } from "@/lib/paintEngine/MaterialSwatch";
import type { Material } from "@/types";

/** Candidates orbit Jev while the field is evaluated. Short and energetic:
 * Jev answers in a few hundred milliseconds, so this never pretends to be slow. */
export function JevThinking({ candidates, model }: { candidates: Material[]; model?: string }) {
  const size = 188;
  const c = size / 2;
  return (
    <div className="flex flex-col items-center py-2" role="status" aria-live="polite">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="absolute inset-0" width={size} height={size} aria-hidden>
          {[34, 56, 78].map((r, i) => (
            <circle key={r} cx={c} cy={c} r={r} fill="none" stroke="rgba(236,232,223,0.1)" strokeDasharray={i === 1 ? "2 5" : undefined} />
          ))}
          {[0, 1, 2].map((k) => (
            <path
              key={k}
              className="es-wave"
              d={`M 8 ${c} Q ${c / 2} ${c - 30 + k * 8} ${c} ${c} T ${size - 8} ${c}`}
              fill="none"
              stroke="var(--color-jev)"
              strokeOpacity={0.35 - k * 0.1}
              strokeWidth={1}
              style={{ animationDuration: `${420 + k * 120}ms` }}
            />
          ))}
        </svg>
        <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}>
          {candidates.map((m, i) => {
            const ring = [56, 78, 34][i % 3];
            const a = (i / candidates.length) * Math.PI * 2;
            return (
              <motion.div
                key={m.id}
                className="absolute h-[22px] w-[22px]"
                style={{ left: c + Math.cos(a) * ring - 11, top: c + Math.sin(a) * ring - 11 }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0.7, 1.15, 0.85], opacity: 1 }}
                transition={{ scale: { duration: 0.6, repeat: Infinity, repeatType: "mirror", delay: i * 0.05 }, opacity: { delay: i * 0.03 } }}
              >
                <MaterialSwatch material={m} slot={`orbit-${i}`} />
              </motion.div>
            );
          })}
        </motion.div>
        <div className="absolute inset-0 grid place-items-center">
          <motion.div
            className="grid h-12 w-12 place-items-center rounded-full border border-jev/60 bg-void text-bone"
            animate={{ boxShadow: ["0 0 0px rgba(198,255,61,0)", "0 0 28px rgba(198,255,61,0.45)", "0 0 0px rgba(198,255,61,0)"] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          >
            <JevGlyph size={22} />
          </motion.div>
        </div>
      </div>
      <div className="es-label mt-3 !text-bone">evaluating material field</div>
      <div className="es-mono mt-1 text-[10px] text-ash">
        {candidates.length} candidates{model ? ` · ${model}` : ""}
      </div>
    </div>
  );
}
