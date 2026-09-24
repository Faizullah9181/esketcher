import { useSyncExternalStore } from "react";

import { prefersReducedMotion } from "./prefers";
import { navigate } from "./router";

/** A paint wipe between the home page and the studio: cover from the click, then reveal. */
export type Splash = { phase: "cover" | "reveal"; x: number; y: number } | null;

export const COVER_MS = 430;
export const REVEAL_MS = 450;

let splash: Splash = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(next: Splash): void {
  splash = next;
  listeners.forEach((listener) => listener());
}

/** Open the studio behind the wipe, or at once when motion is reduced. */
export function openStudio(at?: { x: number; y: number }): void {
  if (!at || prefersReducedMotion()) return navigate("studio");
  if (splash) return;
  set({ phase: "cover", ...at });
  timer = setTimeout(() => {
    navigate("studio");
    set({ phase: "reveal", ...at });
    timer = setTimeout(() => set(null), REVEAL_MS);
  }, COVER_MS);
}

export function resetTransition(): void {
  clearTimeout(timer);
  set(null);
}

export function useSplash(): Splash {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => splash,
    () => null,
  );
}
