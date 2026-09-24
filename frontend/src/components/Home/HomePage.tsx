import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { JevGlyph } from "@/components/common/JevGlyph";
import { Logo } from "@/components/common/Logo";
import { SketchBoard } from "@/lib/canvas/SketchBoard";
import { boardArt } from "@/lib/canvas/boards";
import type { BoardShape } from "@/lib/desk/types";
import { MaterialSwatch } from "@/lib/paintEngine/MaterialSwatch";
import { BEHAVIOR_MOTION } from "@/lib/paintEngine/recipes";
import { createRng } from "@/lib/rng";
import { navigate } from "@/lib/router";
import { OFFLINE, OFFLINE_MESSAGE } from "@/services/api";
import { useStudio } from "@/state/studio";
import type { SketchAsset } from "@/types";

const SHOWCASE = ["eyes", "flowers", "mechanical", "insects", "planets"] as const;
const STAGE_W = 640;
const STAGE_H = 512;
const PAINT_EVERY_MS = 1100;
const ease = [0.16, 1, 0.3, 1] as const;

function asBoard(sketch: SketchAsset, num: number, paints: BoardShape["props"]["paints"]): BoardShape {
  return {
    id: `home-${sketch.id}`,
    type: "board",
    x: 0,
    y: 0,
    w: 320,
    h: 400,
    rotation: 0,
    z: 0,
    locked: false,
    groupId: null,
    props: { num, sketchId: sketch.id, title: sketch.title, category: sketch.category, variant: sketch.variant, seed: sketch.seed, complexity: sketch.complexity, paints, lockedMaterial: null },
  };
}

/** A few sketches painting themselves in a loop: an ambient preview, not Jev decisions. */
function Showcase() {
  const sketches = useStudio((s) => s.sketches);
  const materials = useStudio((s) => s.materials);
  const picks = useMemo(() => SHOWCASE.map((c) => sketches.find((s) => s.category === c)).filter((s): s is SketchAsset => Boolean(s)), [sketches]);
  const [paints, setPaints] = useState<Record<string, BoardShape["props"]["paints"]>>({});
  // the stage is laid out at 640×512 and scaled to whatever width it gets
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
    const timer = setInterval(() => {
      const sketch = rng.pick(picks);
      const regions = boardArt(asBoard(sketch, 0, {})).regions;
      setPaints((all) => {
        const current = all[sketch.id] ?? {};
        const empty = regions.filter((r) => !current[r.id]);
        // once a sketch is full, wipe it and start over
        if (!empty.length) return { ...all, [sketch.id]: {} };
        const region = rng.pick(empty.filter((r) => r.focal).length && rng.chance(0.4) ? empty.filter((r) => r.focal) : empty);
        const kin = regions.filter((r) => r.kind === region.kind && !current[r.id]);
        const material = rng.pick(materials).id;
        const now = Date.now();
        return { ...all, [sketch.id]: { ...current, ...Object.fromEntries(kin.map((r, i) => [r.id, { m: material, t: now + i * 60 }])) } };
      });
    }, PAINT_EVERY_MS);
    return () => clearInterval(timer);
  }, [picks, materials]);

  const layout = [
    { x: 16, y: 44, r: -5, s: 0.62 },
    { x: 200, y: 0, r: 2, s: 0.78 },
    { x: 420, y: 36, r: 4, s: 0.6 },
    { x: 80, y: 262, r: 3, s: 0.52 },
    { x: 330, y: 250, r: -3, s: 0.56 },
  ];
  return (
    <div ref={frame} className="relative mx-auto w-full max-w-[640px] overflow-hidden" style={{ height: STAGE_H * scale }} aria-hidden>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}>
      {picks.map((sketch, i) => {
        const l = layout[i];
        return (
          <motion.div
            key={sketch.id}
            className="absolute origin-top-left"
            style={{ left: l.x, top: l.y, width: 320, height: 400 }}
            initial={{ opacity: 0, y: 30, rotate: l.r, scale: l.s }}
            animate={{ opacity: 1, y: [0, -6, 0], rotate: l.r, scale: l.s }}
            transition={{ opacity: { delay: 0.2 + i * 0.12, duration: 0.8, ease }, y: { duration: 6 + i, repeat: Infinity, ease: "easeInOut" } }}
          >
            <SketchBoard board={asBoard(sketch, i + 1, paints[sketch.id] ?? {})} />
          </motion.div>
        );
      })}
      </div>
    </div>
  );
}

function JevLight() {
  const health = useStudio((s) => s.health);
  const online = Boolean(health?.jev.online);
  if (OFFLINE)
    return (
      <span className="flex items-center gap-2" title={OFFLINE_MESSAGE}>
        <span className="es-dot bg-warn" />
        <span className="es-mono text-[10px] uppercase tracking-[0.14em] text-ash">demo · jev offline</span>
      </span>
    );
  return (
    <span className="flex items-center gap-2">
      <span className={`es-dot ${online ? "es-dot--live" : health ? "bg-warn" : "bg-err"}`} />
      <span className="es-mono text-[10px] uppercase tracking-[0.14em] text-ash">{health ? `jev ${online ? "online" : "offline"} · ${health.jev.mode}` : "jev unreachable"}</span>
    </span>
  );
}

const STEPS = [
  { n: "01", title: "Select", body: "Click a sketch, or take the Jev tool and click one region: an iris, a petal, a gear." },
  { n: "02", title: "Jev decides", body: "The shape is measured and a field of candidate materials goes to Jev, which returns a probability for each, and its confidence." },
  { n: "03", title: "Paint arrives", body: "The winner leaves the material stream, flies across the desk and paints itself in. Or overrule it: Jev is an instrument, not an authority." },
];

export function HomePage() {
  const sketches = useStudio((s) => s.sketches);
  const materials = useStudio((s) => s.materials);
  const behaviors = useMemo(() => new Set(materials.map((m) => m.type)).size, [materials]);
  // one of every behaviour first, then the rest, so the strip shows the full range
  const stream = useMemo(() => {
    const seen = new Set<string>();
    const firsts = materials.filter((m) => !seen.has(m.type) && seen.add(m.type));
    return [...firsts, ...materials.filter((m) => !firsts.includes(m))].slice(0, 24);
  }, [materials]);
  const open = () => navigate("studio");

  return (
    <div className="es-scroll h-full overflow-y-auto bg-void">
      <div className="es-home-bg pointer-events-none fixed inset-0" aria-hidden />
      <nav className="sticky top-0 z-20 flex items-center gap-6 border-b es-hairline bg-void/70 px-6 py-3 backdrop-blur-md" aria-label="Site">
        <Logo />
        <a href="#how" className="es-focus hidden text-[13px] text-ash hover:text-bone sm:inline">
          How it works
        </a>
        <a href="#materials" className="es-focus hidden text-[13px] text-ash hover:text-bone sm:inline">
          Materials
        </a>
        <div className="ml-auto flex items-center gap-4">
          <span className="hidden md:inline">
            <JevLight />
          </span>
          <button className="es-btn es-btn--jev" onClick={open}>
            Open studio
          </button>
        </div>
      </nav>

      <main className="relative">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-14 lg:grid-cols-[1fr_1.1fr] lg:pt-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
            <div className="es-label flex items-center gap-2">
              <JevGlyph size={14} /> a generative painting instrument
            </div>
            <h1 className="mt-6 text-[clamp(44px,7vw,88px)] font-medium leading-[0.92] tracking-[-0.05em]">
              You point.
              <br />
              <span className="text-jev">Jev</span> decides.
              <br />
              The paint flies.
            </h1>
            <p className="mt-6 max-w-md text-[16px] leading-relaxed text-bone/70">
              Select any part of a sketch. Jev, TypeSafe's decision model, weighs a field of materials and shows its confidence. Then the paint arrives, from liquid chrome to pixel dust.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button className="es-btn es-btn--jev !h-11 !px-5" onClick={open}>
                Open studio <ArrowRight size={14} />
              </button>
              <a href="#how" className="es-btn !h-11 !px-5">
                How it works
              </a>
            </div>
          </motion.div>
          <Showcase />
        </section>

        <section className="border-y es-hairline bg-slab/60">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-8 md:grid-cols-4">
            {[
              [String(sketches.length || 105), "procedural sketches"],
              [String(materials.length || 121), "paint materials"],
              [String(behaviors || 13), "paint behaviours"],
              ["1", "decision model: Jev"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="es-label">{label}</dt>
                <dd className="es-mono mt-1 text-[34px] tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
          <div className="es-label">how it works</div>
          <div className="mt-8 grid gap-px bg-[var(--es-line)] md:grid-cols-3">
            {STEPS.map((step, i) => (
              <motion.div key={step.n} className="bg-void p-6" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.6, ease }}>
                <div className="es-mono text-[11px] text-jev">{step.n}</div>
                <h3 className="mt-3 text-[24px] font-medium tracking-tight">{step.title}</h3>
                <p className="mt-3 text-[14px] leading-relaxed text-bone/65">{step.body}</p>
              </motion.div>
            ))}
          </div>
          <p className="es-mono mt-6 text-[11px] text-ash">Press Play in the studio and Jev fills every sketch on the desk by itself.</p>
        </section>

        <section id="materials" className="scroll-mt-20 border-t es-hairline py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="es-label">materials</div>
            <h2 className="mt-4 max-w-xl text-[32px] font-medium leading-tight tracking-tight">Every material is a recipe, not a picture: behaviour, palette, roughness, viscosity.</h2>
          </div>
          <div className="mx-auto mt-10 grid max-w-6xl grid-cols-3 gap-4 px-6 sm:grid-cols-4 lg:grid-cols-6">
            {stream.map((m, i) => (
              <motion.div key={m.id} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: (i % 6) * 0.05 }}>
                <div className="aspect-square">
                  <MaterialSwatch material={m} slot={`home-${i}`} />
                </div>
                <div className="mt-2 truncate text-[11px] uppercase tracking-[0.05em]">{m.name}</div>
                <div className="es-mono truncate text-[9px] text-ash">{BEHAVIOR_MOTION[m.type]}</div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="border-t es-hairline">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-20 md:flex-row md:items-end md:justify-between">
            <h2 className="text-[clamp(32px,5vw,56px)] font-medium leading-[0.95] tracking-[-0.04em]">
              Your desk is waiting.
              <br />
              <span className="text-ash">Twelve sketches are already on it.</span>
            </h2>
            <button className="es-btn es-btn--jev !h-12 !px-6" onClick={open}>
              Open studio <ArrowRight size={14} />
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t es-hairline px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Logo className="!text-[15px]" />
          <JevLight />
        </div>
      </footer>
    </div>
  );
}
