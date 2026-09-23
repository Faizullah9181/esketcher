import { useCallback, useEffect, useState } from "react";

import { ApiError, api, isAbort } from "@/services/api";
import { useStudio } from "@/state/studio";

export type CatalogState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

/** Boot-time load of the material and sketch libraries. */
export function useCatalog(): [CatalogState, () => void] {
  const [state, setState] = useState<CatalogState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    Promise.all([api.materials(controller.signal), api.sketches(controller.signal), api.palettes(controller.signal).catch(() => [])])
      .then(([materials, sketches, palettes]) => {
        useStudio.getState().setCatalog(materials, sketches, palettes);
        setState({ status: "ready" });
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setState({ status: "error", message: error instanceof ApiError ? error.message : "Could not load the studio" });
      });
    return () => controller.abort();
  }, [attempt]);

  return [state, useCallback(() => setAttempt((a) => a + 1), [])];
}
