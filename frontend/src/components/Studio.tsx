import { AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

import { DeskCanvas } from "@/components/Canvas/DeskCanvas";
import { ExperimentsPanel } from "@/components/Header/ExperimentsPanel";
import { Header } from "@/components/Header/Header";
import { SamplingPanel } from "@/components/Header/SamplingPanel";
import { SimulationHud } from "@/components/Header/SimulationControls";
import { DecisionPill } from "@/components/JevDecision/DecisionPill";
import { FlightLayer } from "@/components/JevDecision/FlightLayer";
import { JevPanel } from "@/components/JevPanel/JevPanel";
import { MaterialLibrary } from "@/components/MaterialRail/MaterialLibrary";
import { MaterialRail } from "@/components/MaterialRail/MaterialRail";
import { SketchGallery } from "@/components/SketchGallery/SketchGallery";
import { Toolbar } from "@/components/Toolbar/Toolbar";
import { useChaos } from "@/hooks/useChaos";
import { useProjectSync } from "@/hooks/useProjectSync";
import { Desk } from "@/lib/desk/desk";
import { stopSimulation } from "@/state/simulation";
import { useStudio } from "@/state/studio";

function Drawers() {
  const drawer = useStudio((s) => s.drawer);
  return (
    <AnimatePresence>
      {drawer === "sketches" && <SketchGallery key="sketches" />}
      {drawer === "materials" && <MaterialLibrary key="materials" />}
      {drawer === "experiments" && <ExperimentsPanel key="experiments" />}
      {drawer === "sampling" && <SamplingPanel key="sampling" />}
    </AnimatePresence>
  );
}

/**
 * The whole studio: desk engine, panels, rail and the Jev loop. Loaded as its own
 * chunk so the home page ships without it.
 */
export default function Studio() {
  const [desk] = useState(() => new Desk());
  useEffect(() => {
    useStudio.getState().setDesk(desk);
    if (import.meta.env.DEV) (window as unknown as { __esketcher?: unknown }).__esketcher = { desk };
    return () => {
      // leaving the studio: stop Play, drop transient state; autosave flushes in useProjectSync
      stopSimulation();
      useStudio.getState().setFocus(null);
      useStudio.getState().setDesk(null);
    };
  }, [desk]);
  useProjectSync(desk);
  useChaos();
  return (
    <div className="es-app">
      <Header />
      <Toolbar />
      <main className="relative min-h-0 overflow-hidden [grid-area:canvas]">
        <DeskCanvas desk={desk} />
        <SimulationHud />
        <DecisionPill />
        <Drawers />
      </main>
      <JevPanel />
      <MaterialRail />
      <FlightLayer />
    </div>
  );
}
