import { motion } from "motion/react";
import { Pin, X } from "lucide-react";
import { useMemo, useState } from "react";

import { MaterialSwatch } from "@/lib/paintEngine/MaterialSwatch";
import { BEHAVIOR_MOTION } from "@/lib/paintEngine/recipes";
import { applyManual } from "@/state/jevController";
import { MAX_PINNED, useStudio } from "@/state/studio";
import type { MaterialBehavior } from "@/types";

/** Every material, filterable by behaviour. Click paints the current target (or
 * arms the paint tool); the pin adds a material to every Jev candidate field. */
export function MaterialLibrary() {
  const materials = useStudio((s) => s.materials);
  const pinned = useStudio((s) => s.pinned);
  const armed = useStudio((s) => s.armedMaterial);
  const togglePin = useStudio((s) => s.togglePin);
  const setDrawer = useStudio((s) => s.setDrawer);
  const [behavior, setBehavior] = useState<MaterialBehavior | "all">("all");
  const behaviors = useMemo(() => [...new Set(materials.map((m) => m.type))], [materials]);
  const shown = materials.filter((m) => behavior === "all" || m.type === behavior);

  return (
    <motion.section
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="es-surface absolute inset-y-3 left-3 z-[400] flex w-[min(420px,calc(100%-24px))] flex-col border es-hairline"
      aria-label="Material library"
    >
      <div className="flex items-center justify-between border-b es-hairline px-4 py-3">
        <div>
          <div className="es-label !text-bone">Materials</div>
          <div className="es-mono text-[10px] text-ash">
            {materials.length} procedural paints · {pinned.length}/{MAX_PINNED} pinned to Jev's field
          </div>
        </div>
        <button className="es-focus text-ash hover:text-bone" onClick={() => setDrawer("materials")} aria-label="Close materials">
          <X size={16} />
        </button>
      </div>
      <div className="es-scroll flex gap-1 overflow-x-auto border-b es-hairline px-4 py-3">
        {(["all", ...behaviors] as const).map((b) => (
          <button key={b} onClick={() => setBehavior(b)} className={`es-focus es-mono shrink-0 border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${behavior === b ? "border-jev text-jev" : "es-hairline text-ash hover:text-bone"}`}>
            {b}
          </button>
        ))}
      </div>
      <div className="es-scroll grid flex-1 auto-rows-min grid-cols-3 gap-3 overflow-y-auto p-4 [content-visibility:auto]">
        {shown.map((m) => (
          <div key={m.id} className="group relative">
            <button
              className={`es-focus block w-full text-left ${armed === m.id ? "ring-1 ring-jev ring-offset-2 ring-offset-slab" : ""}`}
              onClick={(e) => {
                if (!applyManual(m.id, null, e.currentTarget.getBoundingClientRect())) useStudio.getState().arm(m.id);
              }}
              title={`${m.name}: ${BEHAVIOR_MOTION[m.type]}`}
            >
              <div className="aspect-square overflow-hidden border es-hairline transition-transform duration-200 group-hover:scale-[1.04]">
                <MaterialSwatch material={m} shape="tile" slot="lib" />
              </div>
              <div className="mt-1.5 truncate text-[11px] uppercase tracking-[0.05em]">{m.name}</div>
              <div className="es-mono truncate text-[9px] text-ash">
                {m.type} / {m.texture}
              </div>
            </button>
            <button
              onClick={() => togglePin(m.id)}
              className={`es-focus absolute right-1 top-1 grid h-6 w-6 place-items-center bg-void/70 transition-opacity ${pinned.includes(m.id) ? "text-jev opacity-100" : "text-bone opacity-0 group-hover:opacity-100"}`}
              aria-label={pinned.includes(m.id) ? `Unpin ${m.name}` : `Pin ${m.name} to Jev's field`}
            >
              <Pin size={12} />
            </button>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
