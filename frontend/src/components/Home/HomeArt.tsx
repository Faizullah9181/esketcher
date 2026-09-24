import { motion, type MotionValue } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { SketchBoard } from "@/lib/canvas/SketchBoard";
import { boardArt } from "@/lib/canvas/boards";
import type { BoardShape } from "@/lib/desk/types";
import { MaterialSwatch } from "@/lib/paintEngine/MaterialSwatch";
import { BEHAVIOR_MOTION } from "@/lib/paintEngine/recipes";
import { prefersReducedMotion } from "@/lib/prefers";
import { createRng } from "@/lib/rng";
import { ART_H, ART_W, type Region } from "@/lib/sketchArt";
import { useStudio } from "@/state/studio";
import type { Material, Paint, SketchAsset } from "@/types";

/**
 * The home page's artwork: the self-painting stage and the material grid. It
 * is the only part of the home page that needs the sketch generators and the
 * paint engine, so it loads as its own chunk after the hero text has painted.
 */

const SHOWCASE = ["eyes", "flowers", "mechanical", "insects", "planets"] as const;
export const STAGE_W = 640;
export const STAGE_H = 600;
const BOARD_W = 320;
const BOARD_H = 400;
/** where the material stream runs, in stage units */
const STREAM_Y = 556;
/** the loop waits for the page to settle before it starts moving things */
export const START_DELAY_MS = 1800;
export const PAINT_EVERY_MS = 1100;
export const FLIGHT_MS = 620;
export const BURST_MS = 700;
const ease = [0.16, 1, 0.3, 1] as const;

/** Board placements on the stage: position, tilt and scale, top-left origin. */
const LAYOUT = [
  { x: 16, y: 44, r: -5, s: 0.62 },
  { x: 200, y: 0, r: 2, s: 0.78 },
  { x: 420, y: 36, r: 4, s: 0.6 },
  { x: 80, y: 262, r: 3, s: 0.52 },
  { x: 330, y: 250, r: -3, s: 0.56 },
];

type Paints = Record<string, Paint>;

interface Flight {
  id: number;
  material: Material;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

interface Burst {
  id: number;
  x: number;
  y: number;
  color: string;
}

export interface Landing {
  id: number;
  region: string;
  material: string;
  sketch: string;
}

export interface Tilt {
  rx: MotionValue<number>;
  ry: MotionValue<number>;
}

let nextId = 1;

function asBoard(sketch: SketchAsset, num: number, paints: Paints): BoardShape {
  return {
    id: `home-${sketch.id}`,
    type: "board",
    x: 0,
    y: 0,
    w: BOARD_W,
    h: BOARD_H,
    rotation: 0,
    z: 0,
    locked: false,
    groupId: null,
    props: { num, sketchId: sketch.id, title: sketch.title, category: sketch.category, variant: sketch.variant, seed: sketch.seed, complexity: sketch.complexity, paints, lockedMaterial: null },
  };
}

/** A region's centre in stage units: art → board → the board's rotate + scale about its top-left. */
function toStage(l: (typeof LAYOUT)[number], region: Region): { x: number; y: number } {
  const bx = (region.centroid[0] * BOARD_W) / ART_W;
  const by = (region.centroid[1] * BOARD_H) / ART_H;
  const rad = (l.r * Math.PI) / 180;
  return { x: l.x + l.s * (bx * Math.cos(rad) - by * Math.sin(rad)), y: l.y + l.s * (bx * Math.sin(rad) + by * Math.cos(rad)) };
}

/**
 * Sketches painting themselves in a loop: a material lifts out of the stream,
 * flies to a region and paints it. An ambient preview, not Jev decisions.
 */
export function Stage({ tilt, onLanding }: { tilt: Tilt; onLanding: (landing: Landing) => void }) {
  const sketches = useStudio((s) => s.sketches);
  const materials = useStudio((s) => s.materials);
  const picks = useMemo(() => SHOWCASE.map((c) => sketches.find((s) => s.category === c)).filter((s): s is SketchAsset => Boolean(s)), [sketches]);
  const stream = useMemo(() => {
    const seen = new Set<string>();
    return materials.filter((m) => !seen.has(m.type) && seen.add(m.type)).concat(materials.filter((m) => m.luminous)).slice(0, 18);
  }, [materials]);
  const paintsRef = useRef<Record<string, Paints>>({});
  const [paints, setPaints] = useState<Record<string, Paints>>({});
  const [flights, setFlights] = useState<Flight[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);

  // the stage is laid out at 640×600 and scaled to whatever width it gets
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.clientWidth / STAGE_W) || 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!picks.length || !materials.length) return;
    const rng = createRng(Date.now());
    const still = prefersReducedMotion();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };
    const commit = (sketchId: string, value: Paints) => {
      paintsRef.current = { ...paintsRef.current, [sketchId]: value };
      setPaints(paintsRef.current);
    };
    const tick = () => {
      const sketch = rng.pick(picks);
      const layout = LAYOUT[picks.indexOf(sketch)];
      const regions = boardArt(asBoard(sketch, 0, {})).regions;
      const current = paintsRef.current[sketch.id] ?? {};
      const empty = regions.filter((r) => !current[r.id]);
      // once a sketch is full, wipe it and start over
      if (!empty.length) return commit(sketch.id, {});
      const focal = empty.filter((r) => r.focal);
      const region = rng.pick(focal.length && rng.chance(0.4) ? focal : empty);
      const kin = regions.filter((r) => r.kind === region.kind && !current[r.id]);
      const material = rng.pick(materials);
      const land = () => {
        const now = Date.now();
        commit(sketch.id, { ...(paintsRef.current[sketch.id] ?? {}), ...Object.fromEntries(kin.map((r, i) => [r.id, { m: material.id, t: now + i * 60 }])) });
        onLanding({ id: nextId++, region: region.label, material: material.name, sketch: sketch.title });
      };
      if (still) return land();
      const id = nextId++;
      const to = toStage(layout, region);
      setFlights((f) => [...f, { id, material, from: { x: rng.range(60, STAGE_W - 60), y: STREAM_Y }, to }]);
      later(() => {
        setFlights((f) => f.filter((x) => x.id !== id));
        setBursts((b) => [...b, { id, x: to.x, y: to.y, color: material.palette[1] }]);
        land();
        later(() => setBursts((b) => b.filter((x) => x.id !== id)), BURST_MS);
      }, FLIGHT_MS);
    };
    let loop: ReturnType<typeof setInterval> | undefined;
    later(() => {
      tick();
      loop = setInterval(tick, PAINT_EVERY_MS);
    }, START_DELAY_MS);
    return () => {
      clearInterval(loop);
      timers.forEach(clearTimeout);
    };
  }, [picks, materials, onLanding]);

  return (
    <div ref={frame} className="es-stage relative mx-auto w-full max-w-[640px]" style={{ height: STAGE_H * scale }} aria-hidden>
      <motion.div className="absolute left-0 top-0 origin-top-left" style={{ width: STAGE_W, height: STAGE_H, scale, rotateX: tilt.rx, rotateY: tilt.ry, transformStyle: "preserve-3d" }}>
        {picks.map((sketch, i) => {
          const l = LAYOUT[i];
          return (
            <motion.div
              key={sketch.id}
              className="absolute origin-top-left"
              style={{ left: l.x, top: l.y, width: BOARD_W, height: BOARD_H }}
              initial={{ opacity: 0, y: 30, rotate: l.r, scale: l.s }}
              animate={{ opacity: 1, y: [0, -6, 0], rotate: l.r, scale: l.s }}
              transition={{ opacity: { delay: 0.2 + i * 0.12, duration: 0.8, ease }, y: { duration: 6 + i, repeat: Infinity, ease: "easeInOut" } }}
            >
              <SketchBoard board={asBoard(sketch, i + 1, paints[sketch.id] ?? {})} />
            </motion.div>
          );
        })}

        <div className="es-stream absolute" style={{ left: 0, top: STREAM_Y - 26, width: STAGE_W, height: 52 }}>
          <div className="es-stream-track">
            {stream.concat(stream).map((m, i) => (
              <span key={i} className="es-stream-chip">
                <MaterialSwatch material={m} slot={`st-${i}`} />
              </span>
            ))}
          </div>
        </div>

        {bursts.map((b) => (
          <span key={b.id} className="es-burst" style={{ left: b.x, top: b.y, "--c": b.color } as React.CSSProperties} />
        ))}
        {flights.map((f) => (
          <motion.div
            key={f.id}
            className="es-flight absolute left-0 top-0"
            style={{ "--c": f.material.palette[1] } as React.CSSProperties}
            initial={{ x: f.from.x - 22, y: f.from.y - 22, scale: 0.7, opacity: 0 }}
            animate={{
              x: [f.from.x - 22, (f.from.x + f.to.x) / 2 - 22, f.to.x - 22],
              y: [f.from.y - 22, Math.min(f.from.y, f.to.y) - 110, f.to.y - 22],
              scale: [0.7, 1.3, 0.35],
              opacity: [0, 1, 1],
            }}
            transition={{ duration: FLIGHT_MS / 1000, ease: [0.3, 0, 0.2, 1], times: [0, 0.55, 1] }}
          >
            <MaterialSwatch material={f.material} slot={`fl-${f.id}`} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

/** One of every behaviour first, then the rest, so the grid shows the full range. */
export function MaterialGrid() {
  const materials = useStudio((s) => s.materials);
  const grid = useMemo(() => {
    const seen = new Set<string>();
    const firsts = materials.filter((m) => !seen.has(m.type) && seen.add(m.type));
    return [...firsts, ...materials.filter((m) => !firsts.includes(m))].slice(0, 24);
  }, [materials]);
  return (
    <div className="mx-auto mt-10 grid max-w-6xl grid-cols-3 gap-4 px-6 sm:grid-cols-4 lg:grid-cols-6">
      {grid.map((m, i) => (
        <motion.div key={m.id} className="es-swatch-card" initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: (i % 6) * 0.05 }}>
          <div className="aspect-square">
            <MaterialSwatch material={m} slot={`home-${i}`} />
          </div>
          <div className="mt-2 truncate text-[11px] uppercase tracking-[0.05em]">{m.name}</div>
          <div className="es-mono truncate text-[9px] text-ash">{BEHAVIOR_MOTION[m.type]}</div>
        </motion.div>
      ))}
    </div>
  );
}
