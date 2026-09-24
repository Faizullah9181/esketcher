import { useEffect } from "react";

import { OFFLINE } from "@/services/api";
import { chaosTick } from "@/state/jevController";
import { useStudio } from "@/state/studio";

const TICK_MS = 4200;

/** While chaos mode is on, Jev keeps making small decisions on visible boards. */
export function useChaos(): void {
  const chaos = useStudio((s) => s.chaos);
  useEffect(() => {
    if (!chaos || OFFLINE) return;
    const timer = setInterval(() => chaosTick(), TICK_MS);
    return () => clearInterval(timer);
  }, [chaos]);
}
