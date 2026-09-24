import { getStroke } from "perfect-freehand";

import { newId } from "./desk";
import type { StrokeShape, StrokeStyle } from "./types";

/** perfect-freehand outline → SVG path (quadratic smoothing between outline points). */
export function outlinePath(outline: number[][]): string {
  if (!outline.length) return "";
  const d = outline.reduce<(string | number)[]>(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0.toFixed(2), y0.toFixed(2), ((x0 + x1) / 2).toFixed(2), ((y0 + y1) / 2).toFixed(2));
      return acc;
    },
    ["M", outline[0][0].toFixed(2), outline[0][1].toFixed(2), "Q"],
  );
  return `${d.join(" ")}Z`;
}

export function strokePath(points: [number, number, number][], size: number, brush: boolean): string {
  return outlinePath(
    getStroke(points, {
      size,
      thinning: brush ? 0 : 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: points.every(([, , p]) => p === 0.5),
      last: true,
    }),
  );
}

/** Build a stroke shape from page-space points; local points are relative to its padded bbox. */
export function strokeFromPoints(page: [number, number, number][], style: StrokeStyle, brush: boolean): StrokeShape {
  const size = brush ? style.size * 3 : style.size;
  const pad = size;
  const xs = page.map(([x]) => x);
  const ys = page.map(([, y]) => y);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return {
    id: newId("stroke"),
    type: "stroke",
    x,
    y,
    w: Math.max(...xs) - x + pad,
    h: Math.max(...ys) - y + pad,
    rotation: 0,
    z: 0,
    locked: false,
    groupId: null,
    points: page.map(([px, py, p]) => [px - x, py - y, p]),
    color: style.color,
    size,
    brush,
  };
}
