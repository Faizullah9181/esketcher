import { ITEM, REACH, ROW_Y, SLOT, STAGE } from "@/state/sampling";
import { useStudio } from "@/state/studio";

const pad = 22;
const slotX = -ITEM.w / 2 - pad;
const slotW = ITEM.w + pad * 2;
const windowX = -(REACH + 0.5) * SLOT;
const windowW = -windowX * 2;
const rowTop = ROW_Y - 30;
const rowH = ITEM.h + 60;

/** Stage, carousel window, the centre slot and the arrow between them, drawn in page space. */
export function SamplingDecor({ layer }: { layer: "under" | "over" }) {
  const run = useStudio((s) => s.sampling);
  if (!run) return null;
  const busy = run.phase === "lifting" || run.phase === "painting";
  const index = Math.min(run.cursor, run.ids.length - 1) + 1;

  if (layer === "over") {
    const fadeW = SLOT * 2.6;
    return (
      <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1} aria-hidden>
        <defs>
          <linearGradient id="es-fade-l" x1="1" x2="0">
            <stop offset="0" stopColor="#06060a" stopOpacity="0" />
            <stop offset="1" stopColor="#06060a" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="es-fade-r" x1="0" x2="1">
            <stop offset="0" stopColor="#06060a" stopOpacity="0" />
            <stop offset="1" stopColor="#06060a" stopOpacity="1" />
          </linearGradient>
        </defs>
        <rect x={windowX - fadeW} y={rowTop - 40} width={fadeW} height={rowH + 80} fill="url(#es-fade-l)" />
        <rect x={-windowX} y={rowTop - 40} width={fadeW} height={rowH + 80} fill="url(#es-fade-r)" />
      </svg>
    );
  }

  const arrow = `M ${slotX} ${ROW_Y + 30} C ${slotX - 260} ${ROW_Y + 10}, ${STAGE.x - 260} ${STAGE.y + STAGE.h * 0.9}, ${STAGE.x - 12} ${STAGE.y + STAGE.h * 0.72}`;
  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1} aria-hidden>
      <defs>
        <marker id="es-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-jev)" />
        </marker>
        <radialGradient id="es-stage-glow">
          <stop offset="0" stopColor="#c6ff3d" stopOpacity="0.16" />
          <stop offset="1" stopColor="#c6ff3d" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* stage */}
      {busy && <ellipse cx={STAGE.x + STAGE.w / 2} cy={STAGE.y + STAGE.h / 2} rx={STAGE.w * 0.95} ry={STAGE.h * 0.8} fill="url(#es-stage-glow)" className="es-stage-glow" />}
      <rect x={STAGE.x - 14} y={STAGE.y - 38} width={STAGE.w + 28} height={STAGE.h + 52} rx={6} fill="none" stroke={busy ? "var(--color-jev)" : "rgba(236,232,223,0.22)"} strokeWidth={busy ? 1.6 : 1} strokeDasharray={busy ? undefined : "6 6"} />
      {run.phase === "painting" && <rect key={`flash-${run.cursor}`} x={STAGE.x - 14} y={STAGE.y - 38} width={STAGE.w + 28} height={STAGE.h + 52} rx={6} fill="none" stroke="var(--color-jev)" className="es-stage-flash" />}
      <text x={STAGE.x - 14} y={STAGE.y - 52} className="es-decor-label" fill={busy ? "var(--color-jev)" : "var(--color-ash)"}>
        {run.phase === "painting" ? "JEV PAINTING" : run.phase === "lifting" ? "ON STAGE" : run.phase === "done" ? "ALL SAMPLES PAINTED" : "STAGE"}
      </text>
      <text x={STAGE.x + STAGE.w + 14} y={STAGE.y - 52} textAnchor="end" className="es-decor-label" fill="var(--color-bone)">
        SAMPLE {String(index).padStart(2, "0")} / {String(run.ids.length).padStart(2, "0")}
      </text>
      {/* arrow: slot → stage */}
      <path d={arrow} fill="none" stroke={busy ? "var(--color-jev)" : "rgba(236,232,223,0.35)"} strokeWidth={1.6} markerEnd="url(#es-arrow)" className={busy ? "es-decor-flow" : undefined} strokeDasharray={busy ? "10 8" : undefined} />

      {/* carousel window */}
      <rect x={windowX} y={rowTop} width={windowW} height={rowH} rx={10} fill="rgba(236,232,223,0.02)" stroke="rgba(236,232,223,0.18)" />
      <text x={windowX + 14} y={rowTop + rowH + 26} className="es-decor-label" fill="var(--color-ash)">
        ← PAINTED
      </text>
      <text x={-windowX - 14} y={rowTop + rowH + 26} textAnchor="end" className="es-decor-label" fill="var(--color-ash)">
        QUEUE →
      </text>

      {/* speed streaks while the carousel slides */}
      {run.phase === "sliding" &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <line key={`${run.cursor}-${i}`} x1={-windowX} x2={-windowX + 260} y1={rowTop + 24 + i * (rowH / 6)} y2={rowTop + 24 + i * (rowH / 6)} stroke="var(--color-jev)" strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" className="es-streak" style={{ animationDelay: `${i * 45}ms`, ["--run" as string]: `${windowX * 2 - 260}px` }} />
        ))}

      {/* centre slot, taller than the window like a card holder */}
      <rect key={run.landed} x={slotX} y={ROW_Y - 70} width={slotW} height={ITEM.h + 140} rx={8} fill="rgba(198,255,61,0.03)" stroke="var(--color-jev)" strokeOpacity={0.7} className={run.landed ? "es-slot-land" : undefined} />
    </svg>
  );
}
