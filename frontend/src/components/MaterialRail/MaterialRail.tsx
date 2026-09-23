import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { boardArt, isBoard, pageToArt } from "@/lib/canvas/boards";
import { regionAtPoint } from "@/lib/canvas/hitTest";
import type { BoardShape } from "@/lib/desk/types";
import { MaterialSwatch } from "@/lib/paintEngine/MaterialSwatch";
import { BEHAVIOR_MOTION } from "@/lib/paintEngine/recipes";
import { applyManual } from "@/state/jevController";
import { useStudio } from "@/state/studio";
import type { Material } from "@/types";

import { registerChip } from "./registry";

interface RowConfig {
  size: number;
  span: number;
  speed: number;
  top: number;
  back: boolean;
  offset: number;
}

const FRONT: RowConfig = { size: 72, span: 94, speed: 24, top: 50, back: false, offset: 0 };
const BACK: RowConfig = { size: 42, span: 60, speed: 11, top: 24, back: true, offset: 37 };
const MOBILE_SCALE = 0.72;
const SHORT_SCALE = 0.56;
const DRAG_THRESHOLD = 6;

interface HoverInfo {
  material: Material;
  x: number;
}

/** Hit-test a screen point against the canvas: which board/region is under it. */
function dropTarget(x: number, y: number) {
  const desk = useStudio.getState().desk;
  if (!desk) return null;
  const point = desk.screenToPage({ x, y });
  const board = desk.shapesAt(point).find((s): s is BoardShape => isBoard(s) && !s.locked);
  if (!board) return null;
  const region = regionAtPoint(boardArt(board), pageToArt(desk, board, point));
  return { boardId: board.id, regionId: region?.id ?? null };
}

const Chip = memo(function Chip({
  material,
  slot,
  row,
  onHover,
}: {
  material: Material;
  slot: number;
  row: RowConfig;
  onHover: (info: HoverInfo | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const candidate = useStudio((s) => s.active?.status === "analyzing" && s.active.candidates.includes(material.id));
  const winner = useStudio((s) => s.active?.status === "ready" && s.active.decision?.selectedMaterial === material.id);
  const armed = useStudio((s) => s.armedMaterial === material.id);

  useEffect(() => (ref.current && !row.back ? registerChip(material.id, ref.current) : undefined), [material.id, row.back]);

  const onPointerDown = (event: React.PointerEvent) => {
    if (row.back || event.button !== 0) return;
    const start = { x: event.clientX, y: event.clientY };
    let ghost: HTMLDivElement | null = null;
    const move = (e: PointerEvent) => {
      if (!ghost && Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_THRESHOLD) {
        ghost = ref.current!.cloneNode(true) as HTMLDivElement;
        Object.assign(ghost.style, { position: "fixed", left: "0", top: "0", width: `${row.size}px`, height: `${row.size}px`, zIndex: "200", pointerEvents: "none", animation: "none", opacity: "0.95" });
        document.body.appendChild(ghost);
      }
      if (ghost) {
        ghost.style.transform = `translate(${e.clientX - row.size / 2}px, ${e.clientY - row.size / 2}px) scale(1.15) rotate(-8deg)`;
        const target = dropTarget(e.clientX, e.clientY);
        useStudio.getState().setHover(target);
      }
    };
    const up = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      useStudio.getState().setHover(null);
      if (ghost) {
        const rect = ghost.getBoundingClientRect();
        ghost.remove();
        const target = dropTarget(e.clientX, e.clientY);
        if (target) applyManual(material.id, target, rect);
        return;
      }
      // a click: paint the current target, or arm the material for the paint tool
      if (!applyManual(material.id, null, ref.current!.getBoundingClientRect())) useStudio.getState().arm(material.id);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const classes = ["es-chip", row.back && "es-chip--back", (candidate || winner) && "es-chip--candidate", armed && "es-chip--armed"].filter(Boolean).join(" ");

  return (
    <div
      ref={ref}
      data-slot={slot}
      className={classes}
      style={{ width: row.size, height: row.size, top: row.top, animationDelay: `${-(slot % 9) * 0.7}s` }}
      onPointerDown={onPointerDown}
      onPointerEnter={() => !row.back && onHover({ material, x: ref.current!.getBoundingClientRect().left + row.size / 2 })}
      onPointerLeave={() => onHover(null)}
      role={row.back ? undefined : "button"}
      aria-label={row.back ? undefined : `${material.name}: ${material.type}, ${material.texture}`}
      tabIndex={row.back ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !applyManual(material.id, null, ref.current!.getBoundingClientRect())) useStudio.getState().arm(material.id);
      }}
    >
      <MaterialSwatch material={material} slot={`${row.back ? "b" : "f"}${slot}`} />
    </div>
  );
});

/** One conveyor row. Offset lives in a ref and is written straight to the DOM;
 * React only re-renders when the visible window of chips shifts by one. */
function Row({ materials, row, width, paused, chaos, onHover, pointerX }: { materials: Material[]; row: RowConfig; width: number; paused: boolean; chaos: boolean; onHover: (h: HoverInfo | null) => void; pointerX: React.RefObject<number | null> }) {
  const track = useRef<HTMLDivElement>(null);
  const offset = useRef(row.offset * row.span);
  const speed = useRef(row.speed);
  const [start, setStart] = useState(0);
  const count = Math.ceil(width / row.span) + 3;

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const target = paused ? row.speed * 0.12 : row.speed * (chaos ? 2.4 : 1);
      speed.current += (target - speed.current) * Math.min(1, dt * 4);
      offset.current += speed.current * dt;
      const first = Math.floor(offset.current / row.span);
      setStart((s) => (s === first ? s : first));
      const el = track.current;
      if (el) {
        el.style.transform = `translate3d(${-(offset.current - first * row.span)}px,0,0)`;
        const px = pointerX.current;
        for (const child of Array.from(el.children) as HTMLElement[]) {
          const i = Number(child.dataset.index);
          const cx = i * row.span + row.size / 2 - (offset.current - first * row.span);
          const near = px === null || row.back ? 0 : Math.exp(-((cx - px) ** 2) / (2 * 70 ** 2));
          const bob = Math.sin(now / 900 + (first + i) * 1.3) * (chaos ? 5 : 2.5);
          child.style.transform = `translate3d(${i * row.span}px, ${bob - near * 16}px, 0) scale(${1 + near * 0.32})`;
          child.style.zIndex = near > 0.5 ? "2" : "1";
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [row, paused, chaos, pointerX]);

  if (!materials.length) return null;
  return (
    <div ref={track} className="absolute inset-y-0 left-0" style={{ willChange: "transform" }}>
      {Array.from({ length: count }, (_, i) => {
        const slot = start + i;
        const material = materials[((slot % materials.length) + materials.length) % materials.length];
        return (
          <div key={slot} data-index={i} className="absolute left-0 top-0">
            <Chip material={material} slot={slot} row={row} onHover={onHover} />
          </div>
        );
      })}
    </div>
  );
}

export function MaterialRail() {
  const materials = useStudio((s) => s.materials);
  const chaos = useStudio((s) => s.chaos);
  const container = useRef<HTMLDivElement>(null);
  const pointerX = useRef<number | null>(null);
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(132);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [inside, setInside] = useState(false);
  const [back, setBack] = useState<Material[]>([]);

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
      setHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => setBack([...materials].reverse()), [materials]);

  // the rail's own height decides chip size: 132px desktop, 96px phones, 76px short screens
  const factor = height < 90 ? SHORT_SCALE : width < 640 || height < 120 ? MOBILE_SCALE : 1;
  const [front, rear] = useMemo(() => {
    const scale = (row: RowConfig): RowConfig =>
      factor === 1 ? row : { ...row, size: row.size * factor, span: row.span * factor, top: row.top * factor };
    return [scale(FRONT), scale(BACK)];
  }, [factor]);
  const onHover = useCallback((info: HoverInfo | null) => setHover(info), []);

  return (
    <section
      ref={container}
      className="es-rail"
      aria-label="Material stream"
      onPointerMove={(e) => {
        const rect = container.current!.getBoundingClientRect();
        pointerX.current = e.clientX - rect.left;
      }}
      onPointerEnter={() => setInside(true)}
      onPointerLeave={() => {
        pointerX.current = null;
        setInside(false);
      }}
    >
      <div className="es-label absolute left-4 top-2 z-[4] flex items-center gap-2 [@media(max-height:520px)]:top-1">
        <span>Material stream</span>
        <span className="text-dim">· {materials.length}</span>
      </div>
      <Row materials={back} row={rear} width={width} paused={inside} chaos={chaos} onHover={onHover} pointerX={pointerX} />
      <Row materials={materials} row={front} width={width} paused={inside} chaos={chaos} onHover={onHover} pointerX={pointerX} />
      {hover && (
        <div
          className="es-surface pointer-events-none fixed bottom-[calc(var(--rail-h)+10px)] z-[95] -translate-x-1/2 border es-hairline px-3 py-2"
          style={{ left: Math.min(Math.max(hover.x, 100), window.innerWidth - 100) }}
        >
          <div className="text-[13px] font-medium uppercase tracking-[0.06em]">{hover.material.name}</div>
          <div className="es-mono mt-0.5 text-[10px] text-ash">
            {hover.material.type} / {hover.material.texture}
            {hover.material.luminous ? " / luminous" : ""}
          </div>
          <div className="es-mono text-[10px] text-dim">{BEHAVIOR_MOTION[hover.material.type]}</div>
        </div>
      )}
    </section>
  );
}
