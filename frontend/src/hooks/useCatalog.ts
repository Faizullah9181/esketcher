import { useCallback, useEffect, useState } from "react";

import { ApiError, api, goOffline, isAbort, isOffline, type Api } from "@/services/api";
import { useStudio } from "@/state/studio";

export type CatalogState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

/** A server that hasn't answered by now counts as down. */
export const CATALOG_TIMEOUT_MS = 6000;

const load = (source: Api, signal?: AbortSignal) =>
  Promise.all([source.materials(signal), source.sketches(signal), source.palettes(signal).catch(() => [])]);

/**
 * Boot-time load of the material and sketch libraries. When the server is down
 * (unreachable, erroring or too slow), the visit switches to offline mode and
 * loads the bundled catalog instead; a reload tries the server again.
 */
export function useCatalog(timeoutMs = CATALOG_TIMEOUT_MS): [CatalogState, () => void] {
  const [state, setState] = useState<CatalogState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    setState({ status: "loading" });
    load(api, controller.signal)
      .catch((error: unknown) => {
        if ((isAbort(error) && !timedOut) || isOffline()) throw error;
        return load(goOffline());
      })
      .then(([materials, sketches, palettes]) => {
        if (controller.signal.aborted && !timedOut) return;
        useStudio.getState().setOffline(isOffline());
        useStudio.getState().setCatalog(materials, sketches, palettes);
        setState({ status: "ready" });
      })
      .catch((error: unknown) => {
        if (isAbort(error) && !timedOut) return;
        setState({ status: "error", message: error instanceof ApiError ? error.message : "Could not load the studio" });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt, timeoutMs]);

  return [state, useCallback(() => setAttempt((a) => a + 1), [])];
}
