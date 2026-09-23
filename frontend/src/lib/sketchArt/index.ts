import { createRng } from "@/lib/rng";
import type { SketchCategory } from "@/types";

import { ArtBuilder } from "./builder";
import { architecture, mechanical, objects, typography } from "./generators/built";
import { geometry, planets, surreal, symbols } from "./generators/cosmic";
import { bodies, eyes, faces, fashion, hands, masks } from "./generators/figures";
import { animals, botanical, creatures, flowers, insects, landscapes, monsters } from "./generators/nature";
import type { SketchArt } from "./types";

export { ART_H, ART_W } from "./types";
export type { Region, SketchArt, Stroke } from "./types";

type Generator = (b: ArtBuilder, variant: number) => void;

export const GENERATORS: Record<SketchCategory, Generator> = {
  faces,
  hands,
  flowers,
  animals,
  insects,
  architecture,
  geometry,
  landscapes,
  planets,
  creatures,
  symbols,
  typography,
  mechanical,
  fashion,
  botanical,
  surreal,
  monsters,
  masks,
  eyes,
  bodies,
  objects,
};

export interface SketchRecipe {
  category: SketchCategory;
  variant: number;
  seed: number;
  complexity: number;
}

const cache = new Map<string, SketchArt>();
const MAX_CACHED = 400;

/** Deterministic line art for a recipe. Memoised: boards, thumbnails and the
 * analyzer all ask for the same drawings repeatedly. */
export function generateSketch(recipe: SketchRecipe): SketchArt {
  const key = `${recipe.category}:${recipe.variant}:${recipe.seed}:${recipe.complexity}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const builder = new ArtBuilder(createRng(recipe.seed), recipe.complexity);
  (GENERATORS[recipe.category] ?? GENERATORS.geometry)(builder, recipe.variant);
  const art = builder.build();
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string);
  cache.set(key, art);
  return art;
}
