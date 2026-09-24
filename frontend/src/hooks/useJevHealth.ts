import { useEffect } from "react";

import { ApiError, OFFLINE, api } from "@/services/api";
import { useStudio } from "@/state/studio";

const POLL_MS = 30_000;

/** Keep the header's JEV / API lights honest. */
export function useJevHealth(): void {
  useEffect(() => {
    if (OFFLINE) return useStudio.getState().setHealth(null, "offline");
    let cancelled = false;
    const check = () =>
      api
        .health()
        .then((health) => !cancelled && useStudio.getState().setHealth(health))
        .catch((error: unknown) => !cancelled && useStudio.getState().setHealth(null, error instanceof ApiError ? error.code : "network"));
    void check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
}
