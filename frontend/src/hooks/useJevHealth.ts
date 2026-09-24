import { useEffect } from "react";

import { ApiError, api } from "@/services/api";
import { useStudio } from "@/state/studio";

const POLL_MS = 30_000;

/** Keep the header's JEV / API lights honest. */
export function useJevHealth(): void {
  const offline = useStudio((s) => s.offline);
  useEffect(() => {
    if (offline) return useStudio.getState().setHealth(null, "offline");
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
  }, [offline]);
}
