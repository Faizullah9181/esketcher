import { harmony } from "@/lib/color";
import type { Material, MaterialBehavior, PaletteDirection, TargetFeatures } from "@/types";

interface ShortlistOptions {
  count: number;
  /** stable per target so the candidate field doesn't reshuffle on every render */
  seed: number;
  exclude?: Iterable<string>;
  /** always included (e.g. pinned by the user) */
  include?: Iterable<string>;
  /** the board's palette direction */
  palette?: PaletteDirection | null;
  /** materials already painted on the board */
  painted?: Material[];
}

/** Which behaviours plausibly suit a target kind. */
const KIND_HINTS: Record<string, MaterialBehavior[]> = {
  eye: ["liquid", "holographic", "ink", "glitter"],
  iris: ["liquid", "holographic", "crystal"],
  pupil: ["ink", "chrome"],
  petal: ["watercolor", "impasto", "glitter"],
  leaf: ["watercolor", "grain", "crystal"],
  gear: ["chrome", "lava", "grain"],
  sky: ["smoke", "watercolor", "holographic"],
  water: ["liquid", "watercolor", "crystal"],
  wing: ["holographic", "glitter", "crystal"],
  letter: ["pixel", "spray", "impasto"],
  face: ["impasto", "watercolor", "grain"],
  skin: ["impasto", "watercolor", "grain"],
  planet: ["lava", "holographic", "smoke"],
  flame: ["lava", "smoke"],
  building: ["grain", "pixel", "chrome"],
  window: ["pixel", "liquid", "glitter"],
  fabric: ["grain", "holographic", "impasto"],
};

const FOCAL_KINDS = ["eye", "iris", "core", "window", "sun", "moon", "heart"];
const BACKGROUND_KINDS = ["sky", "water", "sea", "space", "skin", "face", "fabric", "earth", "dune", "panel"];

function mix(seed: number, index: number): number {
  let x = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** How well a material's colour sits with what's already on the board (-0.6..1). */
export function colourFit(material: Material, painted: Material[]): number {
  if (!painted.length) return 0;
  return painted.reduce((sum, p) => sum + harmony(material.palette[0], p.palette[0]), 0) / painted.length;
}

/**
 * Pick the candidate field for Jev. The field is where colour quality is won:
 * mostly materials from the board's palette that harmonise with what's painted,
 * suited to the region (luminous for focal parts, calmer for backgrounds), at most
 * two per behaviour, plus one contrasting wildcard so Jev can still surprise.
 * The final choice is Jev's; this decides what it chooses between.
 */
export function shortlist(materials: Material[], target: TargetFeatures, opts: ShortlistOptions): string[] {
  const excluded = new Set(opts.exclude ?? []);
  const chosen: string[] = [];
  for (const id of opts.include ?? []) if (!excluded.has(id) && !chosen.includes(id)) chosen.push(id);

  const hints = Object.entries(KIND_HINTS).find(([kind]) => target.kind.includes(kind))?.[1] ?? [];
  const focal = FOCAL_KINDS.some((k) => target.kind.includes(k));
  const background = BACKGROUND_KINDS.some((k) => target.kind.includes(k)) || target.areaRatio > 0.25;
  const families = new Set(opts.palette?.families ?? []);
  const painted = opts.painted ?? [];
  const paintedIds = new Set(painted.map((m) => m.id));

  const scored = materials
    .filter((m) => !excluded.has(m.id) && !chosen.includes(m.id))
    .map((m, i) => {
      let score = mix(opts.seed, i) * 0.35;
      if (hints.includes(m.type)) score += 0.45;
      if (families.has(m.colorFamily)) score += 0.9;
      score += colourFit(m, painted) * 0.5;
      if (focal && m.luminous) score += 0.25;
      if (background && m.intensity > 0.85) score -= 0.25;
      if (background && m.intensity < 0.6) score += 0.15;
      if (paintedIds.has(m.id)) score += 0.1; // repeating a board colour is cohesive, not lazy
      return { material: m, score, inPalette: families.has(m.colorFamily) };
    })
    .sort((a, b) => b.score - a.score);

  const perBehavior = new Map<string, number>();
  const take = (material: Material) => {
    perBehavior.set(material.type, (perBehavior.get(material.type) ?? 0) + 1);
    chosen.push(material.id);
  };
  const room = families.size ? opts.count - 1 : opts.count; // leave one wildcard slot
  for (const { material } of scored) {
    if (chosen.length >= room) break;
    if ((perBehavior.get(material.type) ?? 0) >= 2) continue;
    take(material);
  }
  if (families.size && chosen.length < opts.count) {
    const wildcard = scored.find(({ material, inPalette }) => !inPalette && !chosen.includes(material.id) && colourFit(material, painted) >= 0);
    if (wildcard) take(wildcard.material);
  }
  for (const { material } of scored) {
    if (chosen.length >= opts.count) break;
    if (!chosen.includes(material.id)) take(material);
  }
  return chosen.slice(0, opts.count);
}
