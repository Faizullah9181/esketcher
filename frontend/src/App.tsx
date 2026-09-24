import { motion } from "motion/react";
import { Suspense, lazy, useEffect } from "react";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { JevGlyph } from "@/components/common/JevGlyph";
import { NativeError } from "@/components/common/NativeError";
import { RouteSplash } from "@/components/common/RouteSplash";
import { HomePage } from "@/components/Home/HomePage";
import { useCatalog } from "@/hooks/useCatalog";
import { useJevHealth } from "@/hooks/useJevHealth";
import { applyRouteMeta } from "@/lib/meta";
import { PaintDefs } from "@/lib/paintEngine/PaintDefs";
import { useRoute } from "@/lib/router";

/** The studio is the heavy half of the app; the home page never pays for it. */
export const loadStudio = () => import("@/components/Studio");
const Studio = lazy(loadStudio);

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

export default function App() {
  const [catalog, retry] = useCatalog();
  const route = useRoute();
  useJevHealth();
  useEffect(() => applyRouteMeta(route), [route]);
  // the home page renders at once and fills in sketches when the catalog lands;
  // the studio needs the catalog before it can seed or load a desk
  return (
    <ErrorBoundary>
      <PaintDefs />
      {route === "home" ? (
        <HomePage />
      ) : catalog.status !== "ready" ? (
        <Boot error={catalog.status === "error" ? catalog.message : undefined} onRetry={retry} />
      ) : (
        <Suspense fallback={<Boot onRetry={retry} />}>
          <Studio />
        </Suspense>
      )}
      <RouteSplash />
    </ErrorBoundary>
  );
}
