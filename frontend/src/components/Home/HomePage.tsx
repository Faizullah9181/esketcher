import { AnimatePresence, motion, useSpring } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { JevGlyph } from "@/components/common/JevGlyph";
import { Logo } from "@/components/common/Logo";
import { RouteLink } from "@/components/common/RouteLink";
import { prefersReducedMotion } from "@/lib/prefers";
import { openStudio } from "@/lib/transition";
import { OFFLINE_MESSAGE } from "@/services/api";
import { useStudio } from "@/state/studio";

import type { Landing } from "./HomeArt";

// The artwork needs the sketch generators and the paint engine; the words don't.
// It arrives as its own chunk once the hero text is on screen.
const loadArt = () => import("./HomeArt");
const Stage = lazy(() => loadArt().then((m) => ({ default: m.Stage })));
const MaterialGrid = lazy(() => loadArt().then((m) => ({ default: m.MaterialGrid })));

const ease = [0.16, 1, 0.3, 1] as const;

/** The last few landings, so the loop reads as a process rather than decoration. */
function Ticker({ landings }: { landings: Landing[] }) {
  if (!landings.length) return <div className="es-ticker mt-10 h-[72px]" aria-hidden />;
  return (
    <ul className="es-ticker mt-10 h-[72px] space-y-1" aria-label="Preview loop, not Jev decisions">
      <AnimatePresence initial={false}>
        {landings.map((l, i) => (
          <motion.li
            key={l.id}
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1 - i * 0.35, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease }}
            className="es-mono flex items-center gap-3 text-[11px] uppercase tracking-[0.12em]"
          >
            <span className="es-dot es-dot--live !h-1.5 !w-1.5" />
            <span className="text-ash">{l.sketch}</span>
            <span className="text-bone">{l.region}</span>
            <span className="text-jev">{l.material}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

/** A number that rolls up to its value once, or shows it at once when motion is reduced. */
function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  useEffect(() => {
    if (prefersReducedMotion()) return setShown(value);
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <>{shown}</>;
}

function JevLight() {
  const health = useStudio((s) => s.health);
  const online = Boolean(health?.jev.online);
  const offline = useStudio((s) => s.offline);
  if (offline)
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

  const [landings, setLandings] = useState<Landing[]>([]);
  const onLanding = useMemo(() => (l: Landing) => setLandings((all) => [l, ...all].slice(0, 3)), []);

  // the hero follows the pointer: a light on the backdrop, a tilt on the stage
  const hero = useRef<HTMLElement>(null);
  const rx = useSpring(0, { stiffness: 120, damping: 18 });
  const ry = useSpring(0, { stiffness: 120, damping: 18 });
  const follow = (e: ReactPointerEvent<HTMLElement>) => {
    const el = hero.current;
    if (!el || e.pointerType !== "mouse" || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${Math.round(px * 100)}%`);
    el.style.setProperty("--my", `${Math.round(py * 100)}%`);
    ry.set((px - 0.5) * 12);
    rx.set((0.5 - py) * 9);
  };
  const rest = () => {
    rx.set(0);
    ry.set(0);
  };

  const open = (e: React.MouseEvent) => openStudio({ x: e.clientX || window.innerWidth / 2, y: e.clientY || window.innerHeight / 2 });

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
        <RouteLink to="gallery" className="text-[13px] text-ash hover:text-bone">
          Gallery
        </RouteLink>
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
        <section ref={hero} className="es-hero relative" onPointerMove={follow} onPointerLeave={rest}>
          <div className="es-hero-glow pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-14 lg:grid-cols-[1fr_1.1fr] lg:pt-20">
            <div>
              <div className="es-label flex items-center gap-2">
                <JevGlyph size={14} /> a generative painting instrument
              </div>
              <h1 className="mt-6 text-[clamp(44px,7vw,88px)] font-medium leading-[0.92] tracking-[-0.05em]">
                You point.
                <br />
                <span className="es-jev-word">Jev</span> decides.
                <br />
                <span className="relative inline-block">
                  The paint flies.
                  <svg className="es-underline" viewBox="0 0 300 14" preserveAspectRatio="none" aria-hidden>
                    <path d="M3 9 C 60 2, 120 13, 180 7 S 262 5, 297 8" />
                  </svg>
                </span>
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
              <Ticker landings={landings} />
            </div>
            {/* the placeholder keeps the stage's exact footprint, so nothing shifts when the art lands */}
            <Suspense fallback={<div className="es-stage relative mx-auto aspect-[640/600] w-full max-w-[640px]" aria-hidden />}>
              <Stage tilt={{ rx, ry }} onLanding={onLanding} />
            </Suspense>
          </div>
        </section>

        <section className="border-y es-hairline bg-slab/60">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-8 md:grid-cols-4">
            {[
              [sketches.length || 105, "procedural sketches"],
              [materials.length || 121, "paint materials"],
              [behaviors || 13, "paint behaviours"],
              [1, "decision model: Jev"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="es-label">{label}</dt>
                <dd className="es-mono mt-1 text-[34px] tabular-nums">
                  <CountUp value={value as number} />
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
          <h2 className="es-label">how it works</h2>
          <div className="mt-8 grid gap-px bg-[var(--es-line)] md:grid-cols-3">
            {STEPS.map((step, i) => (
              <motion.div key={step.n} className="es-step bg-void p-6" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.6, ease }}>
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
            <h2 className="es-label">materials</h2>
            <p className="mt-4 max-w-xl text-[32px] font-medium leading-tight tracking-tight">Every material is a recipe, not a picture: behaviour, palette, roughness, viscosity.</p>
          </div>
          <Suspense fallback={<div className="mx-auto mt-10 min-h-[360px] max-w-6xl px-6" aria-hidden />}>
            <MaterialGrid />
          </Suspense>
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
