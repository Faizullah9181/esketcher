import { Pause, Play, Square } from "lucide-react";

import { OFFLINE_MESSAGE } from "@/services/api";
import { pauseSampling, playSampling, stopSampling } from "@/state/sampling";
import { pauseSimulation, startSimulation, stopSimulation } from "@/state/simulation";
import { useStudio } from "@/state/studio";

/** Play: Jev fills every sketch on the desk, one region kind at a time. */
export function SimulationControls() {
  const sim = useStudio((s) => s.sim);
  const offline = useStudio((s) => s.offline);
  const hasBoards = useStudio((s) => Boolean(s.desk));
  // with a sampling carousel built, Play drives the carousel instead of the whole desk
  const sampling = useStudio((s) => s.sampling !== null);
  // closing any drawer first: the carousel needs the whole canvas to be seen
  const start = sampling
    ? () => {
        useStudio.setState({ drawer: "none" });
        return playSampling();
      }
    : startSimulation;
  const pause = sampling ? pauseSampling : pauseSimulation;
  const stop = sampling ? stopSampling : stopSimulation;
  const running = sim.status === "running";
  const active = running || sim.status === "paused" || sim.status === "error";
  const label = { idle: "Play", running: "Pause", paused: "Resume", error: "Resume", done: "Filled" }[sim.status];
  // a finished carousel can be played again (repaint pass)

  return (
    <div className="flex items-center gap-2">
      <button
        disabled={offline || !hasBoards || (sim.status === "done" && !sampling)}
        onClick={() => (running ? pause() : void start())}
        title={offline ? OFFLINE_MESSAGE : running ? "Pause after this decision" : sampling ? "Play the sampling carousel" : "Jev fills every sketch"}
        aria-label={label}
        className={`es-focus flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 transition-colors disabled:opacity-40 max-sm:w-8 max-sm:justify-center max-sm:px-0 ${
          running ? "border-jev bg-jev/10 text-jev" : sim.status === "error" ? "border-warn text-warn" : "border-jev/60 text-bone hover:bg-jev/10"
        }`}
      >
        {running ? <Pause size={13} /> : <Play size={13} className="fill-current" />}
        <span className="es-mono text-[10px] uppercase tracking-[0.14em] max-sm:hidden">{label}</span>
      </button>
      {active && (
        <>
          <div className="hidden w-24 flex-col gap-1 md:flex" aria-label="Simulation progress">
            <span className="es-mono text-[10px] text-ash">
              {sim.done}/{sim.total}
            </span>
            <span className="h-[2px] bg-bone/10">
              <span className="block h-full bg-jev transition-[width] duration-300" style={{ width: `${sim.total ? (sim.done / sim.total) * 100 : 0}%` }} />
            </span>
          </div>
          <button className="es-focus grid h-8 w-8 place-items-center text-ash hover:text-bone" onClick={stop} aria-label="Stop simulation" title="Stop">
            <Square size={12} className="fill-current" />
          </button>
        </>
      )}
    </div>
  );
}

/** What Jev is painting right now, over the canvas. */
export function SimulationHud() {
  const sim = useStudio((s) => s.sim);
  const sampling = useStudio((s) => s.sampling !== null);
  if (sim.status !== "running" && sim.status !== "error" && sim.status !== "done") return null;
  return (
    <div className={`es-surface pointer-events-none absolute left-1/2 z-[350] -translate-x-1/2 border es-hairline px-4 py-2 text-center ${sampling ? "bottom-3 max-sm:bottom-[64px]" : "top-3"}`} role="status" aria-live="polite">
      <div className={`es-label ${sim.status === "error" ? "!text-warn" : "!text-jev"}`}>
        {sim.status === "done" ? "desk filled" : sim.status === "error" ? "jev interrupted · paused" : `${sampling ? "sampling" : "simulating"} · ${Math.min(sim.done + 1, sim.total)}/${sim.total}`}
      </div>
      {sim.status !== "done" && <div className="mt-0.5 max-w-[60vw] truncate text-[12px]">{sim.error ?? sim.current}</div>}
    </div>
  );
}
