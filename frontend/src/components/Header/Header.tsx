import { ChevronLeft, ChevronRight, Menu, PanelRight, Redo2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Logo } from "@/components/common/Logo";
import { RouteLink } from "@/components/common/RouteLink";
import { useDeskValue } from "@/hooks/useDesk";
import { focusBoard, isBoard, listBoards } from "@/lib/canvas/boards";
import type { Desk } from "@/lib/desk/desk";
import { stopSampling } from "@/state/sampling";
import { stopSimulation } from "@/state/simulation";
import { OFFLINE_MESSAGE } from "@/services/api";
import { useStudio, type Drawer } from "@/state/studio";

import { SimulationControls } from "./SimulationControls";

const NAV: { id: Drawer | "universe"; label: string }[] = [
  { id: "universe", label: "Universe" },
  { id: "sketches", label: "Sketches" },
  { id: "materials", label: "Materials" },
  { id: "experiments", label: "Experiments" },
];

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** "Fresh": clear the desk to the empty canvas, after a one-click confirmation. */
function FreshButton({ desk, inMenu = false, onDone }: { desk: Desk | null; inMenu?: boolean; onDone?: () => void }) {
  const [asking, setAsking] = useState(false);
  const count = useDeskValue((s) => Object.keys(s.doc.shapes).length);
  useEffect(() => {
    if (!asking) return;
    const timer = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(timer);
  }, [asking]);
  const clear = () => {
    stopSimulation();
    stopSampling();
    desk?.clear();
    useStudio.getState().setFocus(null);
    useStudio.getState().setActive(null);
    setAsking(false);
    onDone?.();
  };
  if (!desk) return null;
  return (
    <span className={inMenu ? "block" : "relative"}>
      <button
        onClick={() => (count ? setAsking(!asking) : undefined)}
        disabled={!count}
        className={`es-focus text-[13px] tracking-tight text-ash transition-colors hover:text-bone disabled:opacity-40 ${inMenu ? "w-full px-4 py-2.5 text-left" : "px-3 py-2"}`}
        title="Clear the desk and start from an empty canvas"
      >
        Fresh
      </button>
      {asking && (
        <span
          role="dialog"
          aria-label="Start fresh"
          className={`flex flex-col gap-3 p-3 ${inMenu ? "border-t es-hairline" : "es-surface absolute left-0 top-[calc(100%+10px)] z-50 w-[250px] border es-hairline"}`}
        >
          <span className="text-[12px] leading-relaxed text-bone/80">
            Clear all {count} {count === 1 ? "item" : "items"} from the desk? <span className="text-ash">⌘Z brings them back.</span>
          </span>
          <span className="flex gap-2">
            <button className="es-btn es-btn--jev !h-8 flex-1" onClick={clear}>
              Start fresh
            </button>
            <button className="es-btn !h-8" onClick={() => setAsking(false)}>
              Cancel
            </button>
          </span>
        </span>
      )}
    </span>
  );
}

function SaveState() {
  const save = useStudio((s) => s.save);
  const savedAt = useStudio((s) => s.savedAt);
  const now = useNow(5000);
  const label =
    save === "saved" && savedAt
      ? `saved ${Math.max(0, Math.round((now - savedAt) / 1000))}s`
      : { loading: "loading", saving: "saving…", dirty: "unsaved", offline: "offline", error: "save failed", saved: "saved" }[save];
  const tone = save === "offline" || save === "error" ? "text-warn" : save === "saved" ? "text-ash" : "text-bone";
  return <span className={`es-mono hidden text-[10px] uppercase tracking-[0.14em] lg:inline ${tone}`}>{label}</span>;
}

function EditorControls({ desk }: { desk: Desk }) {
  const canUndo = useDeskValue((s) => s.canUndo);
  // ↓ board switcher and zoom % are extras: hidden on narrow screens so the essentials fit
  const canRedo = useDeskValue((s) => s.canRedo);
  const zoom = useDeskValue((s) => s.camera.z);
  const selectedId = useDeskValue((s) => (s.selection.length === 1 ? s.selection[0] : null));
  const selected = useDeskValue((s) => (selectedId ? s.doc.shapes[selectedId] : undefined));
  const current = isBoard(selected) ? { id: selected.id, num: selected.props.num, category: selected.props.category } : null;
  const cycle = (dir: 1 | -1) => {
    const boards = listBoards(desk).sort((a, b) => a.props.num - b.props.num);
    if (!boards.length) return;
    const index = current ? boards.findIndex((b) => b.id === current.id) : -1;
    focusBoard(desk, boards[(index + dir + boards.length) % boards.length].id);
  };
  return (
    <>
      <div className="hidden items-center border-l es-hairline pl-3 xl:flex">
        <button className="es-focus grid h-8 w-7 place-items-center text-ash hover:text-bone" onClick={() => cycle(-1)} aria-label="Previous sketch">
          <ChevronLeft size={15} />
        </button>
        <span className="es-mono min-w-[112px] text-center text-[11px] uppercase tracking-[0.12em]">
          {current ? (
            <>
              <span className="text-bone">{String(current.num).padStart(2, "0")}</span>
              <span className="text-ash"> · {current.category}</span>
            </>
          ) : (
            <span className="text-dim">no sketch</span>
          )}
        </span>
        <button className="es-focus grid h-8 w-7 place-items-center text-ash hover:text-bone" onClick={() => cycle(1)} aria-label="Next sketch">
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="flex items-center gap-1 border-l es-hairline pl-3 max-sm:border-0 max-sm:pl-0">
        <button className="es-focus grid h-8 w-8 place-items-center text-ash hover:text-bone disabled:opacity-25" disabled={!canUndo} onClick={() => desk.undo()} aria-label="Undo">
          <Undo2 size={15} />
        </button>
        <button className="es-focus grid h-8 w-8 place-items-center text-ash hover:text-bone disabled:opacity-25" disabled={!canRedo} onClick={() => desk.redo()} aria-label="Redo">
          <Redo2 size={15} />
        </button>
        <button className="es-focus es-mono ml-1 hidden w-12 text-[11px] text-ash hover:text-bone lg:inline" onClick={() => desk.resetZoom()} title="Reset zoom">
          {Math.round(zoom * 100)}%
        </button>
      </div>
    </>
  );
}

function JevStatus() {
  const health = useStudio((s) => s.health);
  const healthError = useStudio((s) => s.healthError);
  const jev = health?.jev;
  const apiUp = Boolean(health);
  const jevUp = Boolean(jev?.online);
  const offline = useStudio((s) => s.offline);
  if (offline)
    return (
      <div className="flex items-center gap-2" title={OFFLINE_MESSAGE}>
        <span className="es-label !text-bone">Jev</span>
        <span className="es-dot bg-warn" role="img" aria-label="Jev offline: server unreachable" />
        <span className="es-mono hidden text-[10px] uppercase tracking-[0.14em] text-ash lg:inline">demo · offline</span>
      </div>
    );
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2" title={jev ? `${jev.mode} · ${jev.model}${jev.error ? ` · ${jev.error}` : ""}` : (healthError ?? "")}>
        <span className="es-label !text-bone">Jev</span>
        <span className={`es-dot ${jevUp ? "es-dot--live" : apiUp ? "bg-warn" : "bg-err"}`} role="img" aria-label={jevUp ? "Jev online" : "Jev offline"} />
        <span className="es-mono hidden text-[10px] uppercase tracking-[0.14em] text-ash 2xl:inline">
          {jev ? `${jevUp ? "online" : "offline"} · ${jev.mode}` : "—"}
        </span>
      </div>
      <div className="hidden items-center gap-2 xl:flex" title={apiUp ? `API v${health?.version}` : "backend unreachable"}>
        <span className="es-label">API</span>
        <span className={`es-dot ${apiUp ? "bg-bone/70" : "bg-err"}`} />
      </div>
    </div>
  );
}

function SamplingTab({ active, onClick }: { active: boolean; onClick: () => void }) {
  const running = useStudio((s) => s.sampling !== null);
  return (
    <button onClick={onClick} className={`es-focus relative px-3 py-2 text-[13px] tracking-tight transition-colors ${active ? "text-bone" : "text-ash hover:text-bone"}`}>
      Sampling
      {running && <span className="es-dot es-dot--live absolute right-0.5 top-1.5 !h-1.5 !w-1.5" />}
      {active && <span className="absolute inset-x-3 -bottom-[9px] h-px bg-jev" />}
    </button>
  );
}

/** Below xl the view tabs collapse into one menu so the header never overflows. */
function ViewsMenu({ desk, go, drawer }: { desk: Desk | null; go: (id: Drawer | "universe") => void; drawer: Drawer }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative xl:hidden">
      <button className="es-focus grid h-9 w-9 place-items-center text-ash hover:text-bone" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Menu size={18} />
      </button>
      {open && (
        <div role="menu" className="es-surface absolute left-0 top-[calc(100%+8px)] z-50 w-[220px] border es-hairline py-1">
          {NAV.map((item) => {
            const active = item.id === "universe" ? drawer === "none" : drawer === item.id;
            return (
              <button
                key={item.id}
                role="menuitem"
                onClick={() => {
                  go(item.id);
                  setOpen(false);
                }}
                className={`es-focus flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] ${active ? "text-bone" : "text-ash hover:text-bone"}`}
              >
                {item.label}
                {active && <span className="es-dot bg-jev" />}
              </button>
            );
          })}
          <div className="border-t es-hairline">
            <FreshButton desk={desk} inMenu onDone={() => setOpen(false)} />
            <button
              role="menuitem"
              onClick={() => {
                go("sampling");
                setOpen(false);
              }}
              className={`es-focus flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] ${drawer === "sampling" ? "text-bone" : "text-ash hover:text-bone"}`}
            >
              Sampling
              {drawer === "sampling" && <span className="es-dot bg-jev" />}
            </button>
            <RouteLink to="gallery" role="menuitem" className="flex w-full items-center px-4 py-2.5 text-left text-[13px] text-ash hover:text-bone">
              Gallery
            </RouteLink>
          </div>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const desk = useStudio((s) => s.desk);
  const drawer = useStudio((s) => s.drawer);
  const setDrawer = useStudio((s) => s.setDrawer);
  const panelOpen = useStudio((s) => s.panelOpen);
  const setPanelOpen = useStudio((s) => s.setPanelOpen);

  const go = (id: Drawer | "universe") => {
    if (id === "universe") {
      if (drawer !== "none") setDrawer(drawer);
      desk?.zoomToFit();
    } else setDrawer(id);
  };

  return (
    <header className="relative z-40 flex min-w-0 items-center gap-3 border-b es-hairline bg-void/80 px-4 [grid-area:header] max-sm:gap-1.5 max-sm:px-2.5">
      <ViewsMenu desk={desk} go={go} drawer={drawer} />
      <div className="flex shrink-0 items-baseline gap-3">
        <Logo className="max-sm:!text-[17px]" />
        <span className="es-mono hidden text-[10px] uppercase tracking-[0.14em] text-dim 2xl:inline">my universe</span>
      </div>
      <nav className="ml-2 hidden items-center xl:flex" aria-label="Views">
        {NAV.map((item) => {
          const active = item.id === "universe" ? drawer === "none" : drawer === item.id;
          return (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              className={`es-focus relative px-3 py-2 text-[13px] tracking-tight transition-colors ${active ? "text-bone" : "text-ash hover:text-bone"}`}
            >
              {item.label}
              {active && <span className="absolute inset-x-3 -bottom-[9px] h-px bg-jev" />}
            </button>
          );
        })}
        <FreshButton desk={desk} />
        <SamplingTab active={drawer === "sampling"} onClick={() => go("sampling")} />
        <RouteLink to="gallery" className="px-3 py-2 text-[13px] tracking-tight text-ash transition-colors hover:text-bone">
          Gallery
        </RouteLink>
      </nav>
      <div className="ml-auto flex min-w-0 items-center gap-3 max-sm:gap-1">
        <SimulationControls />
        <SaveState />
        {desk && <EditorControls desk={desk} />}
        <div className="border-l es-hairline pl-3 max-md:border-0 max-md:pl-1">
          <JevStatus />
        </div>
        <button className={`es-focus grid h-9 w-9 shrink-0 place-items-center hover:text-bone lg:hidden ${panelOpen ? "text-jev" : "text-ash"}`} onClick={() => setPanelOpen(!panelOpen)} aria-label="Toggle Jev panel" aria-pressed={panelOpen}>
          <PanelRight size={16} />
        </button>
      </div>
    </header>
  );
}
