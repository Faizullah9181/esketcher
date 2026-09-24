import { applyActive, cancelDecision, requestDecision, retryDecision } from "@/state/jevController";
import { useStudio } from "@/state/studio";

/** The Jev panel's view of the current decision, plus the actions it offers. */
export function useJevDecision() {
  const active = useStudio((s) => s.active);
  const focus = useStudio((s) => s.focus);
  const isCurrent = Boolean(active && focus && active.boardId === focus.boardId && active.regionId === focus.regionId);
  return {
    active: isCurrent ? active : null,
    focus,
    decide: () => focus && requestDecision({ ...focus, autoApply: false }),
    decideAndPaint: () => focus && requestDecision({ ...focus, autoApply: true }),
    retry: retryDecision,
    apply: applyActive,
    cancel: cancelDecision,
  };
}
