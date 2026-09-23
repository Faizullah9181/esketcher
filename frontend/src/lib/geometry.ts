export type Pt = [number, number];
export type Poly = Pt[];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const TAU = Math.PI * 2;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function ellipse(cx: number, cy: number, rx: number, ry: number, n = 48, rot = 0): Poly {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    return [cx + x * cos - y * sin, cy + x * sin + y * cos] as Pt;
  });
}

export const circle = (cx: number, cy: number, r: number, n = 40) => ellipse(cx, cy, r, r, n);

export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): Poly {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt;
  });
}

/** Ring sector between two radii; used for rings, which a single polygon can't hold. */
export function sector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, n = 16): Poly {
  return [...arc(cx, cy, r1, r1, a0, a1, n), ...arc(cx, cy, r0, r0, a1, a0, n)];
}

export function rect(x: number, y: number, w: number, h: number): Poly {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

export function star(cx: number, cy: number, outer: number, inner: number, points: number, rot = -Math.PI / 2): Poly {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = rot + (i / (points * 2)) * TAU;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as Pt;
  });
}

export function regular(cx: number, cy: number, r: number, sides: number, rot = -Math.PI / 2): Poly {
  return Array.from({ length: sides }, (_, i) => {
    const a = rot + (i / sides) * TAU;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as Pt;
  });
}

/** Irregular closed blob; jitter is relative to r. */
export function blob(rand: () => number, cx: number, cy: number, r: number, n = 9, jitter = 0.25): Poly {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    const rr = r * (1 - jitter + rand() * jitter * 2);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as Pt;
  });
}

/** Teardrop from base point towards angle; good for petals, leaves, flames. */
export function petal(bx: number, by: number, length: number, width: number, angle: number, n = 20): Poly {
  const pts: Poly = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = Math.sin(Math.PI * t) * width * (1 - t * 0.35);
    pts.push([t * length, w]);
  }
  for (let i = n - 1; i > 0; i--) {
    const t = i / n;
    const w = Math.sin(Math.PI * t) * width * (1 - t * 0.35);
    pts.push([t * length, -w]);
  }
  return transform(pts, { tx: bx, ty: by, rot: angle });
}

/** Rounded bar between two points (limbs, fingers, necks). */
export function capsule(a: Pt, b: Pt, r0: number, r1 = r0, n = 10): Poly {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const side = ang + Math.PI / 2;
  return [
    ...arcAround(b, r1, side - Math.PI, side, n),
    ...arcAround(a, r0, side, side + Math.PI, n),
  ];
}

function arcAround(c: Pt, r: number, a0: number, a1: number, n: number): Poly {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r] as Pt;
  });
}

export function gear(cx: number, cy: number, r: number, teeth: number, depth: number, rot = 0): Poly {
  const pts: Poly = [];
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = rot + i * step;
    for (const [f, rr] of [
      [0, r - depth],
      [0.2, r - depth],
      [0.3, r],
      [0.7, r],
      [0.8, r - depth],
    ] as const) {
      const aa = a + f * step;
      pts.push([cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr]);
    }
  }
  return pts;
}

/** Solid of revolution profile: half-widths sampled top→bottom, mirrored around cx. */
export function lathe(cx: number, top: number, height: number, widths: number[]): Poly {
  const right = widths.map((w, i) => [cx + w, top + (height * i) / (widths.length - 1)] as Pt);
  const left = [...right].reverse().map(([x, y]) => [2 * cx - x, y] as Pt);
  return [...right, ...left];
}

export function wave(x0: number, x1: number, y: number, amp: number, freq: number, phase = 0, n = 40): Poly {
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / n;
    return [x, y + Math.sin(phase + (i / n) * TAU * freq) * amp] as Pt;
  });
}

export function transform(pts: Poly, { tx = 0, ty = 0, rot = 0, sx = 1, sy = sx }: { tx?: number; ty?: number; rot?: number; sx?: number; sy?: number }): Poly {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return pts.map(([x, y]) => {
    const X = x * sx;
    const Y = y * sy;
    return [tx + X * cos - Y * sin, ty + X * sin + Y * cos];
  });
}

export const mirrorX = (pts: Poly, cx: number): Poly => pts.map(([x, y]) => [2 * cx - x, y] as Pt).reverse();

export function bbox(polys: Poly[]): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const poly of polys)
    for (const [x, y] of poly) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  if (x0 === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Shoelace area, always positive. */
export function area(poly: Poly): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    sum += x0 * y1 - x1 * y0;
  }
  return Math.abs(sum) / 2;
}

export function centroid(polys: Poly[]): Pt {
  let ax = 0;
  let ay = 0;
  let total = 0;
  for (const poly of polys) {
    const a = area(poly) || 1e-6;
    let sx = 0;
    let sy = 0;
    for (const [x, y] of poly) {
      sx += x;
      sy += y;
    }
    ax += (sx / poly.length) * a;
    ay += (sy / poly.length) * a;
    total += a;
  }
  return total ? [ax / total, ay / total] : [0, 0];
}

export function length(poly: Poly, closed = false): number {
  let sum = 0;
  const n = closed ? poly.length : poly.length - 1;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    sum += Math.hypot(x1 - x0, y1 - y0);
  }
  return sum;
}

export function pointInPoly([px, py]: Pt, poly: Poly): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Parallel hatch lines clipped to a polygon (even-odd scanline). */
export function hatch(poly: Poly, spacing: number, angle: number): Poly[] {
  const rotated = transform(poly, { rot: -angle });
  const box = bbox([rotated]);
  const lines: Poly[] = [];
  for (let y = box.y + spacing / 2; y < box.y + box.h; y += spacing) {
    const xs: number[] = [];
    for (let i = 0; i < rotated.length; i++) {
      const [x0, y0] = rotated[i];
      const [x1, y1] = rotated[(i + 1) % rotated.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      lines.push(transform([[xs[i], y], [xs[i + 1], y]], { rot: angle }));
    }
  }
  return lines;
}

/** SVG path data. `smooth` runs a Catmull-Rom spline through the points. */
export function toPath(pts: Poly, closed = true, smooth = false): string {
  if (pts.length < 2) return "";
  if (!smooth || pts.length < 3) {
    const body = pts.map(([x, y], i) => `${i ? "L" : "M"}${r2(x)} ${r2(y)}`).join("");
    return closed ? `${body}Z` : body;
  }
  const n = pts.length;
  const at = (i: number): Pt => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(p2[0])} ${r2(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

/** Sutherland–Hodgman clip of a polygon to an axis-aligned box. */
export function clipToBox(poly: Poly, box: Box): Poly {
  const edges: [(p: Pt) => boolean, (a: Pt, b: Pt) => Pt][] = [
    [(p) => p[0] >= box.x, (a, b) => lerpAt(a, b, (box.x - a[0]) / (b[0] - a[0]))],
    [(p) => p[0] <= box.x + box.w, (a, b) => lerpAt(a, b, (box.x + box.w - a[0]) / (b[0] - a[0]))],
    [(p) => p[1] >= box.y, (a, b) => lerpAt(a, b, (box.y - a[1]) / (b[1] - a[1]))],
    [(p) => p[1] <= box.y + box.h, (a, b) => lerpAt(a, b, (box.y + box.h - a[1]) / (b[1] - a[1]))],
  ];
  let out = poly;
  for (const [inside, cut] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cut(prev, cur));
    }
    if (!out.length) return [];
  }
  return out;
}

const lerpAt = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** A tapered band following a centre line: necks, tails, tentacles, roots. */
export function ribbon(line: Poly, w0: number, w1 = w0): Poly {
  const left: Poly = [];
  const right: Poly = [];
  line.forEach((p, i) => {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
    const w = (w0 + (w1 - w0) * (i / Math.max(1, line.length - 1))) / 2;
    left.push([p[0] + Math.cos(ang) * w, p[1] + Math.sin(ang) * w]);
    right.push([p[0] - Math.cos(ang) * w, p[1] - Math.sin(ang) * w]);
  });
  return [...left, ...right.reverse()];
}

/** Part of an elliptical band (e.g. a planetary ring), from angle a0 to a1. */
export function ellipseBand(
  cx: number,
  cy: number,
  outer: [number, number],
  inner: [number, number],
  a0: number,
  a1: number,
  rot = 0,
  n = 28,
): Poly {
  const pts = [...arc(0, 0, outer[0], outer[1], a0, a1, n), ...arc(0, 0, inner[0], inner[1], a1, a0, n)];
  return transform(pts, { tx: cx, ty: cy, rot });
}

/** Sample a quadratic/cubic-ish curve through control points as a polyline. */
export function curve(points: Poly, n = 24): Poly {
  if (points.length < 3) return points;
  const out: Poly = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let pts = points;
    while (pts.length > 1) pts = pts.slice(1).map((p, k) => lerpAt(pts[k], p, t));
    out.push(pts[0]);
  }
  return out;
}
