import type { Desk } from "./desk";
import type { Shape, ShapeId } from "./types";

type Box = Pick<Shape, "x" | "y" | "w" | "h" | "rotation">;
export type Easing = (t: number) => number;

export const easings = {
  outExpo: (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  outBack: (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  inBack: (t: number) => 2.70158 * t ** 3 - 1.70158 * t ** 2,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
};

/** Global speed: 0 makes every move instant (tests, prefers-reduced-motion). */
export const motion = { scale: 1 };

function reducedMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

/**
 * Tween shapes to target boxes with silent frames (no undo steps, no autosave per frame).
 * Resolves when every shape has arrived.
 */
export function animateShapes(desk: Desk, targets: Record<ShapeId, Partial<Box>>, ms: number, ease: Easing = easings.inOutCubic): Promise<void> {
  const ids = Object.keys(targets).filter((id) => desk.getShape(id));
  const from = Object.fromEntries(ids.map((id) => [id, { ...desk.getShape(id)! }]));
  const duration = ms * motion.scale * (reducedMotion() ? 0 : 1);
  const frame = (t: number) => {
    const k = ease(t);
    desk.patchSilently(
      Object.fromEntries(
        ids.map((id) => {
          const a = from[id];
          const b = targets[id];
          const lerp = (key: keyof Box) => (b[key] === undefined ? a[key] : a[key] + ((b[key] as number) - a[key]) * k);
          return [id, { x: lerp("x"), y: lerp("y"), w: lerp("w"), h: lerp("h"), rotation: lerp("rotation") }];
        }),
      ),
    );
  };
  if (!ids.length) return Promise.resolve();
  if (duration <= 0 || typeof requestAnimationFrame === "undefined") {
    frame(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const start = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      frame(t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}
