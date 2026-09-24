import { motion } from "motion/react";
import { memo, useState } from "react";

import { MaterialSwatch } from "@/lib/paintEngine/MaterialSwatch";
import { landFlight } from "@/state/jevController";
import { useStudio, type Burst, type Flight } from "@/state/studio";

const SIZE = 64;
const DURATION = 0.82;
const TRAIL = 5;

interface Splash {
  id: string;
  x: number;
  y: number;
  color: string;
}

/** Keyframes for an arcing flight: lift, accelerate, pass over the canvas, land. */
function path(flight: Flight) {
  const dx = flight.to.x - flight.from.x;
  const dy = flight.to.y - flight.from.y;
  const arc = Math.min(-80, dy * 0.35 - 140);
  return {
    x: [0, dx * 0.04, dx * 0.45, dx * 0.9, dx],
    y: [0, -46, dy * 0.5 + arc, dy * 0.95, dy],
    times: [0, 0.16, 0.55, 0.88, 1],
  };
}

const FlightItem = memo(function FlightItem({ flight, onLand }: { flight: Flight; onLand: (f: Flight) => void }) {
  const material = useStudio((s) => s.materialsById.get(flight.materialId));
  const { x, y, times } = path(flight);
  const base = { left: flight.from.x - SIZE / 2, top: flight.from.y - SIZE / 2, width: SIZE, height: SIZE };
  const ease = [0.55, 0, 0.3, 1] as const;
  if (!material) return null;
  return (
    <>
      {Array.from({ length: TRAIL }, (_, i) => (
        <motion.div
          key={i}
          className="fixed rounded-full"
          style={{ ...base, background: material.palette[i % 2 ? 1 : 0], filter: "blur(6px)" }}
          initial={{ x: 0, y: 0, scale: 0.2, opacity: 0 }}
          animate={{ x, y, scale: [0.2, 0.4 - i * 0.05, 0.3 - i * 0.04, 0.15, 0], opacity: [0, 0.7 - i * 0.12, 0.5 - i * 0.08, 0.2, 0] }}
          transition={{ duration: DURATION, times, ease, delay: 0.035 * (i + 1) }}
        />
      ))}
      <motion.div
        className="fixed"
        style={{ ...base, filter: "drop-shadow(0 14px 24px rgba(0,0,0,0.7))" }}
        initial={{ x: 0, y: 0, scale: 1, rotate: 0 }}
        animate={{ x, y, scale: [1, 1.35, 1.1, 0.7, 0.35], rotate: [0, -14, 18, 6, 0] }}
        transition={{ duration: DURATION, times, ease }}
        onAnimationComplete={() => onLand(flight)}
      >
        <MaterialSwatch material={material} slot={`flight-${flight.id}`} />
      </motion.div>
    </>
  );
});

function SplashItem({ splash, onDone }: { splash: Splash; onDone: (id: string) => void }) {
  return (
    <>
      <motion.div
        className="fixed rounded-full border-2"
        style={{ left: splash.x - 20, top: splash.y - 20, width: 40, height: 40, borderColor: splash.color }}
        initial={{ scale: 0.3, opacity: 1 }}
        animate={{ scale: 3.4, opacity: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        onAnimationComplete={() => onDone(splash.id)}
      />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <motion.div
            key={i}
            className="fixed h-2 w-2 rounded-full"
            style={{ left: splash.x - 4, top: splash.y - 4, background: splash.color }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * (38 + (i % 3) * 14), y: Math.sin(a) * (38 + (i % 3) * 14), opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
    </>
  );
}

function BurstItem({ burst }: { burst: Burst }) {
  const removeBurst = useStudio((s) => s.removeBurst);
  const cx = burst.x + burst.w / 2;
  const cy = burst.y + burst.h / 2;
  return (
    <>
      {Array.from({ length: 28 }, (_, i) => {
        const sx = burst.x + ((i * 37) % 100) / 100 * burst.w;
        const sy = burst.y + ((i * 61) % 100) / 100 * burst.h;
        return (
          <motion.div
            key={i}
            className="fixed h-1.5 w-1.5 bg-bone"
            style={{ left: sx, top: sy }}
            initial={{ x: 0, y: 0, opacity: 0.9 }}
            animate={{ x: cx - sx, y: cy - sy, opacity: 0, scale: 0.2 }}
            transition={{ duration: 0.5, ease: [0.7, 0, 0.84, 0], delay: (i % 7) * 0.012 }}
            onAnimationComplete={i === 0 ? () => removeBurst(burst.id) : undefined}
          />
        );
      })}
    </>
  );
}

/** Overlay above everything: flights, landing splashes and deletion collapses. */
export function FlightLayer() {
  const flights = useStudio((s) => s.flights);
  const bursts = useStudio((s) => s.bursts);
  const [splashes, setSplashes] = useState<Splash[]>([]);

  const onLand = (flight: Flight) => {
    const color = useStudio.getState().materialsById.get(flight.materialId)?.palette[1] ?? "#fff";
    setSplashes((s) => [...s, { id: flight.id, x: flight.to.x, y: flight.to.y, color }]);
    landFlight(flight.id);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]" aria-hidden>
      {flights.map((f) => (
        <FlightItem key={f.id} flight={f} onLand={onLand} />
      ))}
      {splashes.map((s) => (
        <SplashItem key={s.id} splash={s} onDone={(id) => setSplashes((all) => all.filter((x) => x.id !== id))} />
      ))}
      {bursts.map((b) => (
        <BurstItem key={b.id} burst={b} />
      ))}
    </div>
  );
}
