import { AnimatePresence, motion } from "motion/react";

import { COVER_MS, REVEAL_MS, useSplash } from "@/lib/transition";

const wipe = [0.7, 0, 0.3, 1] as const;

/**
 * The route wipe: a disc of Jev green spreads from the click with the void a
 * beat behind it, the studio mounts underneath, and the cover fades away.
 */
export function RouteSplash() {
  const splash = useSplash();
  return (
    <AnimatePresence>
      {splash && (
        <motion.div
          key="splash"
          className="es-splash-layer pointer-events-none fixed inset-0 z-[60]"
          aria-hidden
          initial={{ opacity: 1 }}
          animate={{ opacity: splash.phase === "reveal" ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: REVEAL_MS / 1000, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.span className="es-splash es-splash--jev" style={{ left: splash.x, top: splash.y }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: COVER_MS / 1000, ease: wipe }} />
          <motion.span className="es-splash" style={{ left: splash.x, top: splash.y }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: COVER_MS / 1000, delay: 0.1, ease: wipe }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
