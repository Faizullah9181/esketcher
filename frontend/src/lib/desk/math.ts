import type { Rect, Shape, Vec } from "./types";

export const rotate = (p: Vec, angle: number): Vec => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};

export const center = (s: Pick<Shape, "x" | "y" | "w" | "h">): Vec => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });

/** Local (unrotated, top-left origin) → page. */
export function localToPage(s: Pick<Shape, "x" | "y" | "w" | "h" | "rotation">, p: Vec): Vec {
  const c = center(s);
  const r = rotate({ x: p.x - s.w / 2, y: p.y - s.h / 2 }, s.rotation);
  return { x: c.x + r.x, y: c.y + r.y };
}

/** Page → local (unrotated, top-left origin). */
export function pageToLocal(s: Pick<Shape, "x" | "y" | "w" | "h" | "rotation">, p: Vec): Vec {
  const c = center(s);
  const r = rotate({ x: p.x - c.x, y: p.y - c.y }, -s.rotation);
  return { x: r.x + s.w / 2, y: r.y + s.h / 2 };
}

/** Axis-aligned bounds of a (possibly rotated) shape. */
export function shapeBounds(s: Pick<Shape, "x" | "y" | "w" | "h" | "rotation">): Rect {
  if (!s.rotation) return { x: s.x, y: s.y, w: s.w, h: s.h };
  const corners = [
    { x: 0, y: 0 },
    { x: s.w, y: 0 },
    { x: s.w, y: s.h },
    { x: 0, y: s.h },
  ].map((p) => localToPage(s, p));
  return rectOf(corners);
}

export function rectOf(points: Vec[]): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function union(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  return rectOf(rects.flatMap((r) => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h }]));
}

export const intersects = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

export const normalizeRect = (a: Vec, b: Vec): Rect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) });

/** Distance from p to segment ab. */
export function segmentDistance(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
