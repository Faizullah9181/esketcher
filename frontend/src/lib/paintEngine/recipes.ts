import { blob, type Box, type Pt } from "@/lib/geometry";
import { createRng } from "@/lib/rng";
import { shiftHue } from "@/lib/color";
import type { Material, MaterialBehavior } from "@/types";

/** How long each behaviour takes to arrive, before viscosity slows it down. */
const BASE_MS: Record<MaterialBehavior, number> = {
  liquid: 900,
  spray: 1000,
  watercolor: 1500,
  ink: 1000,
  chrome: 800,
  pixel: 900,
  smoke: 1700,
  glitter: 1200,
  lava: 1900,
  holographic: 1000,
  grain: 1100,
  crystal: 850,
  impasto: 1200,
};

export function revealDuration(material: Pick<Material, "type" | "viscosity">): number {
  return Math.round(BASE_MS[material.type] * (0.8 + material.viscosity * 0.6));
}

/** Longest reveal among materials, padded; times a board's "painting" state. */
export function longestReveal(materials: (Pick<Material, "type" | "viscosity"> | undefined)[]): number {
  return Math.max(600, ...materials.map((m) => (m ? revealDuration(m) : 900))) + 400;
}

/** How the reveal animates, in words — shown as material metadata in the UI. */
export const BEHAVIOR_MOTION: Record<MaterialBehavior, string> = {
  liquid: "flows in as a blob",
  spray: "particles scatter and settle",
  watercolor: "soft translucent blooms",
  ink: "branches and bleeds",
  chrome: "reflective sweep",
  pixel: "grid assembles",
  smoke: "diffuses",
  glitter: "orbits and settles",
  lava: "rises, slow and viscous",
  holographic: "spectrum shimmer",
  grain: "hatched in, dry",
  crystal: "facets lock in",
  impasto: "thick strokes sweep",
};

export interface Particle {
  x: number;
  y: number;
  r: number;
  dx: number;
  dy: number;
  delay: number;
  color: number;
}

/** Scattered particles inside a box, each with its offset from the impact point. */
export function particles(box: Box, origin: Pt, seed: number, count: number, spread = 1): Particle[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => {
    const x = box.x + rng() * box.w;
    const y = box.y + rng() * box.h;
    return {
      x,
      y,
      r: rng.range(0.8, 3.2),
      dx: (origin[0] - x) * spread,
      dy: (origin[1] - y) * spread,
      delay: rng() * 0.45,
      color: rng.int(0, 2),
    };
  });
}

export interface Cell {
  x: number;
  y: number;
  s: number;
  color: number;
  delay: number;
}

/** Pixel grid covering a box, capped so huge regions stay cheap. */
export function pixelCells(box: Box, origin: Pt, seed: number, roughness: number, maxCells = 420): Cell[] {
  const rng = createRng(seed);
  const s = Math.max(8 + roughness * 10, Math.sqrt((box.w * box.h) / maxCells));
  const cells: Cell[] = [];
  const reach = Math.hypot(box.w, box.h) || 1;
  for (let x = box.x; x < box.x + box.w; x += s)
    for (let y = box.y; y < box.y + box.h; y += s) {
      const dist = Math.hypot(x - origin[0], y - origin[1]) / reach;
      cells.push({ x, y, s: s - 1, color: rng.int(0, 2), delay: dist * 0.6 + rng() * 0.2 });
    }
  return cells;
}

export interface Facet {
  points: Pt[];
  color: number;
  opacity: number;
  delay: number;
}

/** Jittered triangle mesh for crystalline materials. */
export function facets(box: Box, origin: Pt, seed: number, maxFacets = 120): Facet[] {
  const rng = createRng(seed);
  const cols = Math.max(2, Math.min(8, Math.round(box.w / 40)));
  const rows = Math.max(2, Math.min(8, Math.round(box.h / 40)));
  const pad = 6;
  const grid: Pt[][] = [];
  for (let c = 0; c <= cols; c++) {
    grid.push([]);
    for (let r = 0; r <= rows; r++) {
      const edge = c === 0 || r === 0 || c === cols || r === rows;
      const jx = edge ? 0 : rng.range(-0.35, 0.35);
      const jy = edge ? 0 : rng.range(-0.35, 0.35);
      grid[c].push([box.x - pad + ((c + jx) * (box.w + pad * 2)) / cols, box.y - pad + ((r + jy) * (box.h + pad * 2)) / rows]);
    }
  }
  const reach = Math.hypot(box.w, box.h) || 1;
  const out: Facet[] = [];
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const [a, b, d, e] = [grid[c][r], grid[c + 1][r], grid[c][r + 1], grid[c + 1][r + 1]];
      for (const tri of rng.chance(0.5) ? [[a, b, e], [a, e, d]] : [[a, b, d], [b, e, d]]) {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
        const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        out.push({ points: tri, color: rng.int(0, 2), opacity: rng.range(0.55, 0.95), delay: (Math.hypot(cx - origin[0], cy - origin[1]) / reach) * 0.5 });
      }
    }
  return out.slice(0, maxFacets);
}

export interface BrushStroke {
  d: string;
  width: number;
  color: number;
  delay: number;
}

/** Wide, slightly curved strokes sweeping across a box at a shared angle. */
export function brushStrokes(box: Box, seed: number, roughness: number): BrushStroke[] {
  const rng = createRng(seed);
  const angle = rng.range(-0.7, 0.7);
  const width = 14 + roughness * 22;
  const count = Math.min(28, Math.max(5, Math.ceil(Math.hypot(box.w, box.h) / (width * 0.7))));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const span = Math.hypot(box.w, box.h) * 0.6;
  return Array.from({ length: count }, (_, i) => {
    const offset = (i / (count - 1 || 1) - 0.5) * span * 1.6;
    const nx = -Math.sin(angle) * offset;
    const ny = Math.cos(angle) * offset;
    const x0 = cx + nx - Math.cos(angle) * span;
    const y0 = cy + ny - Math.sin(angle) * span;
    const x1 = cx + nx + Math.cos(angle) * span;
    const y1 = cy + ny + Math.sin(angle) * span;
    const tilt = rng.range(-0.22, 0.22) * span;
    const bend = rng.range(-30, 30);
    const d = `M${x0.toFixed(1)} ${(y0 - tilt).toFixed(1)}Q${(cx + nx + bend).toFixed(1)} ${(cy + ny - bend).toFixed(1)} ${x1.toFixed(1)} ${(y1 + tilt).toFixed(1)}`;
    return { d, width: width * rng.range(0.8, 1.25), color: rng.int(0, 2), delay: (i / count) * 0.5 };
  });
}

/** Branching random walks from the impact point: how ink bleeds. */
export function inkBranches(box: Box, origin: Pt, seed: number, count = 9): string[] {
  const rng = createRng(seed);
  const reach = Math.hypot(box.w, box.h);
  return Array.from({ length: count }, (_, i) => {
    let angle = (i / count) * Math.PI * 2 + rng.range(-0.3, 0.3);
    let [x, y] = origin;
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    const steps = 7;
    for (let s = 0; s < steps; s++) {
      angle += rng.range(-0.6, 0.6);
      const len = (reach / steps) * rng.range(0.6, 1.2);
      x += Math.cos(angle) * len;
      y += Math.sin(angle) * len;
      d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  });
}

/** Soft organic blobs spread across a box: watercolor blooms, smoke, magma. */
export function blobs(box: Box, seed: number, count: number, scale = 0.45): { d: string; color: number; delay: number; cx: number; cy: number }[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, (_, i) => {
    const cx = box.x + rng() * box.w;
    const cy = box.y + rng() * box.h;
    const r = Math.max(box.w, box.h) * scale * rng.range(0.6, 1.1);
    const pts = blob(rng, cx, cy, r, 9, 0.28);
    return { d: `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`, color: i % 3, delay: rng() * 0.4, cx, cy };
  });
}

/** Wobbly closed blob used as the growing reveal mask of a liquid. */
export function wobble(origin: Pt, radius: number, seed: number): string {
  const pts = blob(createRng(seed), origin[0], origin[1], radius, 14, 0.18);
  return `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;
}

export function reachFrom(origin: Pt, box: Box): number {
  const corners: Pt[] = [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]];
  return Math.max(...corners.map(([x, y]) => Math.hypot(x - origin[0], y - origin[1]))) * 1.08;
}

/** Seven-stop spectrum derived from a material's palette. */
export function spectrum(palette: [string, string, string]): string[] {
  return [palette[0], shiftHue(palette[0], 50), palette[1], shiftHue(palette[1], 70), palette[2], shiftHue(palette[2], -60), palette[0]];
}
