import { replay } from "@/state/jevController";
import { useStudio } from "@/state/studio";

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

export function DecisionHistory({ limit = 8 }: { limit?: number }) {
  const history = useStudio((s) => s.history);
  const materials = useStudio((s) => s.materialsById);
  if (!history.length) {
    return <p className="es-mono text-[11px] text-dim">No decisions yet. The first one is the best one.</p>;
  }
  return (
    <ol className="space-y-px">
      {history.slice(0, limit).map((h) => {
        const m = materials.get(h.materialId);
        return (
          <li key={h.id}>
            <button onClick={() => replay(h)} className="es-focus group grid w-full grid-cols-[40px_1fr_auto] gap-x-3 px-1 py-1.5 text-left hover:bg-bone/[0.04]" title="Focus the sketch and replay this paint">
              <span className="es-mono pt-px text-[10px] text-ash">{time(h.at)}</span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] uppercase tracking-[0.08em]">{h.target}</span>
                <span className="flex items-center gap-1.5 truncate text-[11px] text-bone/60">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: m?.palette[0] }} />
                  {m?.name ?? h.materialId}
                </span>
              </span>
              <span className="es-mono text-right text-[10px]">
                <span className={h.provider === "manual" ? "text-ash" : h.certainty === "uncertain" ? "text-warn" : "text-bone"}>
                  {h.provider === "manual" ? "manual" : `${Math.round(h.confidence * 100)}%`}
                </span>
                <span className="block text-dim group-hover:text-jev">replay</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
