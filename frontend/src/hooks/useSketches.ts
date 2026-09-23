import { useMemo } from "react";

import { useStudio } from "@/state/studio";
import type { SketchAsset, SketchCategory } from "@/types";

export function useSketches() {
  return useStudio((s) => s.sketches);
}

/** Filter the library by category and a free-text query over title and tags. */
export function filterSketches(sketches: SketchAsset[], category: SketchCategory | "all", query: string): SketchAsset[] {
  const q = query.trim().toLowerCase();
  return sketches.filter(
    (s) =>
      (category === "all" || s.category === category) &&
      (!q || s.title.toLowerCase().includes(q) || s.tags.some((t) => t.includes(q))),
  );
}

export function useFilteredSketches(category: SketchCategory | "all", query: string) {
  const sketches = useSketches();
  return useMemo(() => filterSketches(sketches, category, query), [sketches, category, query]);
}
