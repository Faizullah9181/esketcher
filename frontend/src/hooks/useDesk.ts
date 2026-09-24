import { useStore } from "zustand";

import { Desk, type DeskState } from "@/lib/desk/desk";
import { useStudio } from "@/state/studio";

const inert = new Desk();

/** Subscribe to the active desk. Selectors must return stable values (primitives or store objects). */
export function useDeskValue<T>(selector: (state: DeskState) => T): T {
  const desk = useStudio((s) => s.desk) ?? inert;
  return useStore(desk.store, selector);
}
