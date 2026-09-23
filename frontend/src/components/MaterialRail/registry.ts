/** Rail chips register their DOM nodes so a paint flight can take off from the
 * exact thumbnail the user sees. */
const chips = new Map<string, Set<HTMLElement>>();

export function registerChip(materialId: string, el: HTMLElement): () => void {
  const set = chips.get(materialId) ?? new Set();
  set.add(el);
  chips.set(materialId, set);
  return () => {
    set.delete(el);
    if (!set.size) chips.delete(materialId);
  };
}

/** The on-screen chip for a material closest to the horizontal centre, if any. */
export function chipRect(materialId: string): DOMRect | null {
  const set = chips.get(materialId);
  if (!set) return null;
  const mid = window.innerWidth / 2;
  let best: DOMRect | null = null;
  for (const el of set) {
    const rect = el.getBoundingClientRect();
    if (rect.right < 0 || rect.left > window.innerWidth || rect.width === 0) continue;
    if (!best || Math.abs(rect.left + rect.width / 2 - mid) < Math.abs(best.left + best.width / 2 - mid)) best = rect;
  }
  return best;
}
