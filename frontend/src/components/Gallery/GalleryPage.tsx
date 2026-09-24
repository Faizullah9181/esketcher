import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Logo } from "@/components/common/Logo";
import { RouteLink } from "@/components/common/RouteLink";
import { prefersReducedMotion } from "@/lib/prefers";
import { openStudio } from "@/lib/transition";

import { FILM, PAINTINGS, STUDIO, type GalleryImage } from "./items";

const ease = [0.16, 1, 0.3, 1] as const;

type Open = { set: GalleryImage[]; index: number } | null;

/** Full-size view of one image, with arrows through its set. */
function Lightbox({ open, onClose, onStep }: { open: NonNullable<Open>; onClose: () => void; onStep: (delta: number) => void }) {
  const item = open.set[open.index];
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onStep(1);
      else if (e.key === "ArrowLeft") onStep(-1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, onStep]);
  const many = open.set.length > 1;
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      className="es-lightbox fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 p-4 sm:p-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.img
        key={item.src}
        src={item.src}
        alt={item.title}
        className="max-h-[78vh] max-w-full object-contain shadow-2xl"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease }}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex max-w-3xl items-center gap-4 text-center" onClick={(e) => e.stopPropagation()}>
        {many && (
          <button className="es-focus grid h-9 w-9 shrink-0 place-items-center border es-hairline text-ash hover:text-bone" aria-label="Previous" onClick={() => onStep(-1)}>
            <ChevronLeft size={16} />
          </button>
        )}
        <div>
          <div className="text-[15px] font-medium tracking-tight">{item.title}</div>
          <div className="es-mono mt-1 text-[11px] text-ash">{item.note}</div>
        </div>
        {many && (
          <button className="es-focus grid h-9 w-9 shrink-0 place-items-center border es-hairline text-ash hover:text-bone" aria-label="Next" onClick={() => onStep(1)}>
            <ChevronRight size={16} />
          </button>
        )}
      </div>
      <button ref={close} className="es-focus absolute right-4 top-4 grid h-10 w-10 place-items-center text-ash hover:text-bone" aria-label="Close" onClick={onClose}>
        <X size={20} />
      </button>
    </motion.div>
  );
}

function Section({ id, label, title, children }: { id: string; label: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16">
      <h2 className="es-label">{label}</h2>
      <p className="mt-3 max-w-2xl text-[26px] font-medium leading-tight tracking-tight">{title}</p>
      {children}
    </section>
  );
}

export default function GalleryPage() {
  const [open, setOpen] = useState<Open>(null);
  const show = (set: GalleryImage[], index: number) => setOpen({ set, index });
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((delta: number) => setOpen((o) => (o ? { ...o, index: (o.index + delta + o.set.length) % o.set.length } : o)), []);
  const still = prefersReducedMotion();
  const toStudio = (e: React.MouseEvent) => openStudio({ x: e.clientX || window.innerWidth / 2, y: e.clientY || window.innerHeight / 2 });

  return (
    <div className="es-scroll h-full overflow-y-auto bg-void">
      <div className="es-home-bg pointer-events-none fixed inset-0" aria-hidden />
      <nav className="sticky top-0 z-20 flex items-center gap-6 border-b es-hairline bg-void/70 px-6 py-3 backdrop-blur-md" aria-label="Site">
        <Logo />
        <RouteLink to="home" className="text-[13px] text-ash hover:text-bone max-sm:hidden">
          Home
        </RouteLink>
        <RouteLink to="gallery" current className="text-[13px] text-bone">
          Gallery
        </RouteLink>
        <div className="ml-auto">
          <button className="es-btn es-btn--jev" onClick={toStudio}>
            Open studio
          </button>
        </div>
      </nav>

      <main className="relative">
        <header className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-8 pt-14 lg:grid-cols-[0.9fr_1.1fr] lg:pt-20">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }}>
            <div className="es-label">gallery</div>
            <h1 className="mt-5 text-[clamp(40px,6vw,76px)] font-medium leading-[0.95] tracking-[-0.05em]">
              Every colour here
              <br />
              was <span className="es-jev-word">Jev's</span> call.
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-bone/70">
              Fifty sketches, painted in one run. Jev picked a palette for each, then a paint for every region. Nothing retouched.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#paintings" className="es-btn !h-11 !px-5">
                See the paintings
              </a>
              <a href="#film" className="es-btn !h-11 !px-5">
                Watch the run
              </a>
            </div>
          </motion.div>
          <figure className="es-gallery-frame overflow-hidden border es-hairline">
            <video className="block aspect-[16/10] w-full bg-slab" src={FILM.loop.src} poster={FILM.loop.poster} autoPlay={!still} loop muted playsInline controls={still} preload="metadata" aria-label="A sketch lifts onto the stage and Jev paints it" />
            <figcaption className="es-mono border-t es-hairline px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-ash">Lift, palette, a paint for every region, drop</figcaption>
          </figure>
        </header>

        <Section id="paintings" label="paintings" title="Twelve of the fifty, straight off the stage.">
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {PAINTINGS.map((p, i) => (
              <motion.li key={p.src} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ delay: (i % 4) * 0.06, duration: 0.5, ease }}>
                <button className="es-gallery-card es-focus group block w-full text-left" onClick={() => show(PAINTINGS, i)} aria-label={`Open ${p.title}`}>
                  <span className="block overflow-hidden border es-hairline bg-slab">
                    <img src={p.src} alt={`${p.title}, painted by Jev`} width={p.width} height={p.height} loading="lazy" decoding="async" className="block aspect-[680/800] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                  </span>
                  <span className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] tracking-tight">{p.title}</span>
                    <span className="es-mono shrink-0 text-[9px] uppercase tracking-[0.14em] text-ash">{p.note}</span>
                  </span>
                </button>
              </motion.li>
            ))}
          </ul>
        </Section>

        <Section id="studio" label="the studio" title="Jev shows its work: a probability for every paint, and how sure it is.">
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {STUDIO.map((s, i) => (
              <button key={s.src} className="es-gallery-card es-focus group text-left" onClick={() => show(STUDIO, i)} aria-label={`Open ${s.title}`}>
                <span className="block overflow-hidden border es-hairline bg-slab">
                  <img src={s.src} alt={`The studio: ${s.note}`} width={s.width} height={s.height} loading="lazy" decoding="async" className="block aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                </span>
                <span className="mt-3 block text-[15px] font-medium tracking-tight">{s.title}</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-bone/65">{s.note}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section id="film" label="the run" title="All fifty, start to finish.">
          <figure className="es-gallery-frame mt-8 overflow-hidden border es-hairline">
            <video className="block aspect-[16/10] w-full bg-slab" src={FILM.full.src} poster={FILM.full.poster} controls playsInline preload="none" aria-label="A full Sampling run: fifty sketches painted by Jev" />
          </figure>
        </Section>

        <section className="border-t es-hairline">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 md:flex-row md:items-end md:justify-between">
            <h2 className="text-[clamp(28px,4.5vw,48px)] font-medium leading-[0.95] tracking-[-0.04em]">
              Now paint your own.
              <br />
              <span className="text-ash">Fifty samples, one click.</span>
            </h2>
            <button className="es-btn es-btn--jev !h-12 !px-6" onClick={toStudio}>
              Open studio <ArrowRight size={14} />
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t es-hairline px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Logo className="!text-[15px]" />
          <span className="es-mono text-[10px] uppercase tracking-[0.14em] text-ash">painted by jev</span>
        </div>
      </footer>

      <AnimatePresence>{open && <Lightbox open={open} onClose={close} onStep={step} />}</AnimatePresence>
    </div>
  );
}
