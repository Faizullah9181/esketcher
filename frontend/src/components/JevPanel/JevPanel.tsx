import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Lock, LockOpen, RotateCcw, Undo2, X } from "lucide-react";
import { useState } from "react";

import { JevGlyph } from "@/components/common/JevGlyph";
import { NativeError } from "@/components/common/NativeError";
import { JevThinking } from "@/components/JevDecision/JevThinking";
import { ProbabilityField } from "@/components/JevDecision/ProbabilityField";
import { useDeskValue } from "@/hooks/useDesk";
import { useJevDecision } from "@/hooks/useJevDecision";
import { boardArt, isBoard, setLockedMaterial } from "@/lib/canvas/boards";
import { groupBy } from "@/lib/collections";
import type { Desk } from "@/lib/desk/desk";
import type { BoardShape } from "@/lib/desk/types";
import { MaterialSwatch } from "@/lib/paintEngine/MaterialSwatch";
import { applyManual } from "@/state/jevController";
import { OFFLINE } from "@/services/api";
import { historyStats, useStudio } from "@/state/studio";

import { DecisionHistory } from "./DecisionHistory";
import { StructureReadout } from "./StructureReadout";

const section = "border-b es-hairline px-5 py-4";

/** A representative colour for each material family, for the palette strip. */
const FAMILY_SWATCH: Record<string, string> = {
  neon: "#ff2bd6", spectral: "#6fe9ff", toxic: "#9dff00", fire: "#ff5a1f", candy: "#ff3d7f", earth: "#b5562b",
  ocean: "#1fb8a8", ice: "#bfe9ff", metal: "#c9ced6", forest: "#5a8a2a", pastel: "#ffb3c6", mono: "#6e6e6e", royal: "#6b3fa8",
};
const familySwatch = (family: string) => FAMILY_SWATCH[family] ?? "#888";
const spatial = { initial: { opacity: 0, x: 14 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -10 }, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const } };

function IdlePanel() {
  const history = useStudio((s) => s.history);
  const health = useStudio((s) => s.health);
  const stats = historyStats(history);
  return (
    <motion.div key="idle" {...spatial} className="flex flex-1 flex-col">
      <div className={section}>
        <div className="flex items-center justify-between">
          <span className="es-label !text-bone">Jev system</span>
          <span className="es-mono text-[10px] text-jev">{OFFLINE ? "DEMO" : health?.jev.online ? "READY" : "STANDBY"}</span>
        </div>
        {OFFLINE ? (
          <>
            <p className="mt-6 text-[26px] font-medium leading-[1.05] tracking-[-0.03em]">
              Jev is offline
              <br />
              <span className="text-jev">on this demo.</span>
            </p>
            <p className="mt-4 text-[12px] leading-relaxed text-ash">
              Everything else works: sketches, 121 materials, the canvas and manual painting. Click a material in the stream, then take the paint tool (B) and click a region. Run eSketcher locally to let Jev decide.
            </p>
          </>
        ) : (
          <>
            <p className="mt-6 text-[26px] font-medium leading-[1.05] tracking-[-0.03em]">
              Select something
              <br />
              and I'll choose
              <br />
              <span className="text-jev">a material.</span>
            </p>
            <p className="mt-4 text-[12px] leading-relaxed text-ash">Click a sketch to analyse it, or take the Jev tool (J) and click any region to decide and paint in one move.</p>
          </>
        )}
      </div>
      <div className={`${section} grid grid-cols-2 gap-4`}>
        <div>
          <div className="es-label">decisions today</div>
          <div className="es-mono mt-1 text-[28px] tabular-nums">{stats.today}</div>
        </div>
        <div>
          <div className="es-label">avg confidence</div>
          <div className="es-mono mt-1 text-[28px] tabular-nums">{stats.avgConfidence === null ? "—" : `${Math.round(stats.avgConfidence * 100)}%`}</div>
        </div>
        <div className="col-span-2 flex items-center justify-between">
          <span className="es-label">provider</span>
          <span className="es-mono text-[11px] uppercase">
            {OFFLINE ? "not deployed" : health ? `${health.jev.mode} · ${health.jev.model}` : "unreachable"}
          </span>
        </div>
      </div>
      <div className="mt-auto px-5 py-4">
        <div className="es-label mb-3">recent decisions</div>
        <DecisionHistory />
      </div>
    </motion.div>
  );
}

function TargetPanel({ desk, board }: { desk: Desk; board: BoardShape }) {
  const { active, focus, decide, retry, apply } = useJevDecision();
  const materials = useStudio((s) => s.materialsById);
  const setFocus = useStudio((s) => s.setFocus);
  const [manual, setManual] = useState(false);
  const regions = boardArt(board).regions;
  const region = focus?.regionId ? regions.find((r) => r.id === focus.regionId) : null;
  const kinds = groupBy(regions, (r) => r.kind);
  const locked = board.props.lockedMaterial;
  const palette = useStudio((s) => s.palettes.find((p) => p.id === board.props.palette));
  const decision = active?.status === "ready" ? active.decision : undefined;
  const candidates = (active?.candidates ?? []).map((id) => materials.get(id)).filter((m) => m !== undefined);

  const pickManually = (materialId: string) => {
    applyManual(materialId, focus);
    setManual(false);
  };

  return (
    <motion.div key={`target-${board.id}`} {...spatial}>
      <div className={section}>
        <div className="flex items-center justify-between">
          <span className="es-label !text-bone">Jev analysis</span>
          <button className="es-focus text-ash hover:text-bone" onClick={() => desk.selectNone()} aria-label="Clear selection">
            <X size={14} />
          </button>
        </div>
        <div className="mt-4 es-label">target</div>
        <div className="mt-1 text-[18px] font-medium tracking-tight">
          {board.props.title}
          <span className="text-ash"> / {region ? region.label : "whole sketch"}</span>
        </div>
        {palette && (
          <div className="mt-2 flex items-center gap-2" title={palette.description}>
            <span className="es-label">palette</span>
            <span className="flex gap-0.5">
              {palette.families.map((family) => (
                <span key={family} className="h-2 w-4" style={{ background: familySwatch(family) }} />
              ))}
            </span>
            <span className="es-mono text-[11px] uppercase text-bone">{palette.name}</span>
          </div>
        )}
        <div className="es-scroll mt-3 flex max-h-[76px] flex-wrap gap-1 overflow-y-auto">
          <button onClick={() => setFocus({ boardId: board.id, regionId: null })} className={`es-focus es-mono border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${!region ? "border-jev text-jev" : "es-hairline text-ash hover:text-bone"}`}>
            all
          </button>
          {kinds.map(([kind, members]) => {
            const current = region?.kind === kind;
            const painted = members.some((r) => board.props.paints[r.id]);
            const cycle = () => {
              const index = current ? members.findIndex((r) => r.id === region?.id) : -1;
              setFocus({ boardId: board.id, regionId: members[(index + 1) % members.length].id });
            };
            return (
              <button
                key={kind}
                onClick={cycle}
                onMouseEnter={() => useStudio.getState().setHover({ boardId: board.id, regionId: members[0].id })}
                onMouseLeave={() => useStudio.getState().setHover(null)}
                title={members.length > 1 ? `${members.length} ${kind} regions; click to cycle` : members[0].label}
                className={`es-focus es-mono border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${current ? "border-jev text-jev" : "es-hairline text-ash hover:text-bone"}`}
              >
                {kind}
                {members.length > 1 && <span className="text-dim"> ×{members.length}</span>}
                {painted && <span className="text-jev"> •</span>}
              </button>
            );
          })}
        </div>
      </div>

      {active && (
        <div className={section}>
          <div className="es-label mb-3">structure</div>
          <StructureReadout features={active.features} />
        </div>
      )}

      <div className={section}>
        <div className="es-label mb-3">material field</div>
        {locked ? (
          <div className="flex items-center gap-3">
            <span className="h-8 w-8">{materials.get(locked) && <MaterialSwatch material={materials.get(locked)!} slot="locked" />}</span>
            <div className="text-[12px]">
              Locked to <span className="text-warn">{materials.get(locked)?.name}</span>. Jev is bypassed for this sketch.
            </div>
          </div>
        ) : !active && OFFLINE ? (
          <NativeError code="offline">
            <button className="es-btn es-btn--jev" onClick={() => setManual(true)}>
              Pick a material
            </button>
          </NativeError>
        ) : !active ? (
          <button className="es-btn es-btn--jev w-full" onClick={decide}>
            <JevGlyph size={16} /> Ask Jev
          </button>
        ) : active.status === "analyzing" ? (
          <JevThinking candidates={candidates} />
        ) : active.status === "error" ? (
          <NativeError code={active.error?.code ?? "unknown"}>
            <button className="es-btn" onClick={decide}>
              Retry
            </button>
            <button className="es-btn" onClick={() => setManual(true)}>
              Continue manually
            </button>
          </NativeError>
        ) : (
          decision && <ProbabilityField decision={decision} materials={materials} onPick={(id) => apply(id)} />
        )}
      </div>

      {(decision || active?.status === "error" || locked) && (
        <div className="sticky bottom-0 z-10 space-y-2 border-y es-hairline bg-slab/95 px-5 py-3 backdrop-blur-md">
          {decision && !locked && (
            <>
              <button className="es-btn es-btn--jev w-full" onClick={() => apply()}>
                {decision.certainty === "uncertain" ? "Apply anyway" : "Apply"} · {materials.get(decision.selectedMaterial)?.name}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button className="es-btn" onClick={retry}>
                  <RotateCcw size={13} /> Try another
                </button>
                <button className="es-btn" onClick={() => setManual(!manual)}>
                  Pick manually
                </button>
              </div>
            </>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button
              className="es-btn !px-2"
              onClick={() => setLockedMaterial(desk, board.id, locked ? null : (decision?.selectedMaterial ?? null))}
              disabled={!locked && !decision}
              title="Always paint this sketch with this material"
            >
              {locked ? <LockOpen size={13} /> : <Lock size={13} />} {locked ? "Unlock" : "Material"}
            </button>
            <button className="es-btn !px-2" onClick={() => desk.toggleLock([board.id])} title="Lock the sketch against edits and painting">
              <Lock size={13} /> Sketch
            </button>
            <button className="es-btn !px-2" onClick={() => desk.undo()} title="Undo">
              <Undo2 size={13} /> Undo
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {manual && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b es-hairline">
            <div className="px-5 py-4">
              <div className="es-label mb-3">choose manually</div>
              <div className="grid grid-cols-5 gap-2">
                {(candidates.length ? candidates : [...materials.values()].slice(0, 15)).map((m) => (
                  <button key={m.id} className="es-focus aspect-square transition-transform hover:scale-110" onClick={() => pickManually(m.id)} title={m.name}>
                    <MaterialSwatch material={m} slot={`manual-${m.id}`} />
                  </button>
                ))}
              </div>
              <p className="es-mono mt-3 text-[10px] text-dim">or click any material in the stream below</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PanelBody({ desk }: { desk: Desk }) {
  const focusId = useStudio((s) => s.focus?.boardId ?? null);
  const shape = useDeskValue((s) => (focusId ? s.doc.shapes[focusId] : undefined));
  const board = isBoard(shape) ? shape : null;
  return <AnimatePresence mode="wait">{board ? <TargetPanel desk={desk} board={board} /> : <IdlePanel />}</AnimatePresence>;
}

export function JevPanel() {
  const desk = useStudio((s) => s.desk);
  const open = useStudio((s) => s.panelOpen);
  const setOpen = useStudio((s) => s.setPanelOpen);
  return (
    <aside
      aria-label="Jev intelligence panel"
      className={`es-scroll z-30 flex flex-col overflow-y-auto border-l es-hairline bg-slab/95 [grid-area:panel] max-lg:fixed max-lg:bottom-[var(--rail-h)] max-lg:right-0 max-lg:top-[var(--header-h)] max-lg:w-[min(380px,100vw)] max-lg:shadow-[-30px_0_60px_rgba(0,0,0,0.6)] max-lg:backdrop-blur-xl max-lg:transition-transform max-lg:duration-300 ${open ? "" : "max-lg:translate-x-full"}`}
    >
      <div className="flex border-b es-hairline lg:hidden">
        <button className="es-focus es-mono flex items-center gap-2 px-5 py-3 text-[10px] uppercase tracking-[0.14em] text-ash hover:text-bone" onClick={() => setOpen(false)} aria-label="Close panel">
          <ArrowLeft size={13} /> back to canvas
        </button>
      </div>
      {desk && <PanelBody desk={desk} />}
    </aside>
  );
}
