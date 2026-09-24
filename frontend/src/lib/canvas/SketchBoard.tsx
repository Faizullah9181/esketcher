import { memo, useEffect, useMemo, useRef, useState } from "react";

import { PaintLayer } from "@/lib/paintEngine/PaintLayer";
import { ART_H, ART_W, type SketchArt } from "@/lib/sketchArt";
import { useStudio, type SketchState } from "@/state/studio";
import type { Paint } from "@/types";

import type { BoardShape } from "@/lib/desk/types";

import { boardArt } from "./boards";

const REVEAL_WINDOW_MS = 6000;
const EXIT_MS = 480;

/** Line art never changes for a board, so it renders once. */
const Ink = memo(function Ink({ art }: { art: SketchArt }) {
  return (
    <g fill="none" stroke="var(--es-ink)" strokeLinecap="round" strokeLinejoin="round">
      {art.strokes.map((s, i) => (
        <path key={i} d={s.d} strokeWidth={s.w} strokeOpacity={s.o} />
      ))}
    </g>
  );
});

/** Paints that just disappeared (undo, replaced) linger briefly so removal is visible. */
function useExitingPaints(paints: Record<string, Paint>): [string, Paint][] {
  const previous = useRef(paints);
  const [exiting, setExiting] = useState<[string, Paint][]>([]);
  useEffect(() => {
    const removed = Object.entries(previous.current).filter(([id, p]) => paints[id]?.t !== p.t);
    previous.current = paints;
    if (!removed.length) return;
    setExiting((e) => [...e, ...removed]);
    const timer = setTimeout(() => setExiting((e) => e.filter((x) => !removed.includes(x))), EXIT_MS);
    return () => clearTimeout(timer);
  }, [paints]);
  return exiting;
}

export const SketchBoard = memo(function SketchBoard({ board }: { board: BoardShape }) {
  const { category, variant, seed, complexity, paints, num, title, lockedMaterial } = board.props;
  const art = useMemo(() => boardArt(board), [category, variant, seed, complexity]); // eslint-disable-line react-hooks/exhaustive-deps
  const uidBase = board.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const materials = useStudio((s) => s.materialsById);
  const transient = useStudio((s) => s.boardState[board.id]);
  const focus = useStudio((s) => (s.focus?.boardId === board.id ? s.focus.regionId : undefined));
  const hover = useStudio((s) => (s.hover?.boardId === board.id ? s.hover.regionId : undefined));
  const chaos = useStudio((s) => s.chaos);
  const exiting = useExitingPaints(paints);
  const painted = Object.keys(paints).length > 0;
  const status: SketchState = transient ?? (focus !== undefined ? "selected" : painted ? "painted" : "idle");
  const now = Date.now();
  const hoverRegion = hover ? art.regions.find((r) => r.id === hover) : null;
  const focusRegion = focus ? art.regions.find((r) => r.id === focus) : null;

  const layer = (regionId: string, paint: Paint, isExiting = false) => {
    const region = art.regions.find((r) => r.id === regionId);
    const material = materials.get(paint.m);
    if (!region || !material) return null;
    const age = now - paint.t;
    return (
      <PaintLayer
        key={`${regionId}-${paint.t}${isExiting ? "-x" : ""}`}
        uid={`${uidBase}-${regionId}-${paint.t}${isExiting ? "x" : ""}`}
        material={material}
        region={region}
        origin={region.centroid}
        animate={!isExiting && age < REVEAL_WINDOW_MS && age > -2000}
        ambient={chaos ? "alive" : "calm"}
        exiting={isExiting}
      />
    );
  };

  return (
    <div className={`es-board es-board--${status}${chaos ? " es-board--chaos" : ""}`} data-board-state={status}>
      <svg viewBox={`0 0 ${ART_W} ${ART_H}`} width="100%" height="100%" preserveAspectRatio="none" className="es-board__art">
        <rect width={ART_W} height={ART_H} fill="var(--es-paper)" />
        <rect width={ART_W} height={ART_H} fill="url(#es-noise)" opacity={0.05} style={{ mixBlendMode: "overlay" }} />
        {art.regions.map((region) => (paints[region.id] ? layer(region.id, paints[region.id]) : null))}
        {exiting.map(([regionId, paint]) => layer(regionId, paint, true))}
        <Ink art={art} />
        {hoverRegion && hoverRegion.id !== focus && (
          <path d={hoverRegion.d} className="es-region-hover" />
        )}
        {focusRegion && <path d={focusRegion.d} className="es-region-focus" />}
        {status === "analyzing" && <rect className="es-scan" x={0} y={0} width={ART_W} height={6} />}
      </svg>
      <div className="es-board__label">
        <span className="es-board__num">{String(num).padStart(2, "0")}</span>
        <span className="es-board__title">{title}</span>
        <span className="es-board__cat">{category}</span>
      </div>
      {lockedMaterial && <div className="es-board__lock">LOCKED · {materials.get(lockedMaterial)?.name ?? lockedMaterial}</div>}
      {status === "painting" && <div className="es-board__pulse" />}
      {board.locked && <div className="es-board__lock es-board__lock--sketch">LOCKED</div>}
    </div>
  );
});
