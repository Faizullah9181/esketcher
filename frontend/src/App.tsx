import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { JevGlyph } from "@/components/common/JevGlyph";
import { NativeError } from "@/components/common/NativeError";
import { DeskCanvas } from "@/components/Canvas/DeskCanvas";
import { ExperimentsPanel } from "@/components/Header/ExperimentsPanel";
import { SamplingPanel } from "@/components/Header/SamplingPanel";
import { HomePage } from "@/components/Home/HomePage";
import { Header } from "@/components/Header/Header";
import { SimulationHud } from "@/components/Header/SimulationControls";
import { DecisionPill } from "@/components/JevDecision/DecisionPill";
import { FlightLayer } from "@/components/JevDecision/FlightLayer";
import { JevPanel } from "@/components/JevPanel/JevPanel";
import { MaterialLibrary } from "@/components/MaterialRail/MaterialLibrary";
import { MaterialRail } from "@/components/MaterialRail/MaterialRail";
import { SketchGallery } from "@/components/SketchGallery/SketchGallery";
import { Toolbar } from "@/components/Toolbar/Toolbar";
import { useCatalog } from "@/hooks/useCatalog";
import { useChaos } from "@/hooks/useChaos";
import { useJevHealth } from "@/hooks/useJevHealth";
import { useProjectSync } from "@/hooks/useProjectSync";
import { Desk } from "@/lib/desk/desk";
import { PaintDefs } from "@/lib/paintEngine/PaintDefs";
import { useRoute } from "@/lib/router";
import { stopSimulation } from "@/state/simulation";
import { useStudio } from "@/state/studio";

function Boot({ error, onRetry }: { error?: string; onRetry: () => void }) {
  return (
    <div className="grid h-full place-items-center bg-void">
      <div className="w-[min(360px,90vw)]">
        {error ? (
          <NativeError code="network">
            <button className="es-btn" onClick={onRetry}>
              Retry
            </button>
          </NativeError>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4">
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}>
              <JevGlyph size={28} />
            </motion.span>
            <div>
              <div className="text-[20px] font-semibold tracking-[-0.04em]">
                <span className="text-jev">e</span>Sketcher
              </div>
              <div className="es-label mt-1">calibrating material field</div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

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

function Studio() {
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

export default function App() {
  const [catalog, retry] = useCatalog();
  const route = useRoute();
  useJevHealth();
  return (
    <ErrorBoundary>
      <PaintDefs />
      {catalog.status !== "ready" ? (
        <Boot error={catalog.status === "error" ? catalog.message : undefined} onRetry={retry} />
      ) : route === "studio" ? (
        <Studio />
      ) : (
        <HomePage />
      )}
    </ErrorBoundary>
  );
}
