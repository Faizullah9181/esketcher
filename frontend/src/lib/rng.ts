/** Small seeded PRNG (mulberry32) so every procedural drawing is reproducible. */
export interface Rng {
  (): number;
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
  /** approximately normal, mean 0, sd 1 */
  gauss(): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0 || 0x9e3779b9;
  const next = (() => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rng;
  next.range = (min, max) => min + (max - min) * next();
  next.int = (min, max) => Math.floor(next.range(min, max + 1));
  next.pick = (items) => items[Math.floor(next() * items.length)];
  next.chance = (p) => next() < p;
  next.gauss = () => (next() + next() + next() + next() - 2) * 1.7;
  return next;
}

/** Stable 32-bit hash of a string (FNV-1a). */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
