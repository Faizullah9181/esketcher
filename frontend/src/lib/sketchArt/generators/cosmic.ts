import {
  arc,
  blob,
  capsule,
  circle,
  clipToBox,
  ellipse,
  ellipseBand,
  lathe,
  petal,
  rect,
  regular,
  ribbon,
  star,
  transform,
  wave,
  type Poly,
  type Pt,
} from "@/lib/geometry";

import type { ArtBuilder } from "../builder";

const PI = Math.PI;
const ART = { x: 0, y: 0, w: 400, h: 500 };

function starfield(b: ArtBuilder, count: number) {
  for (let i = 0; i < count; i++) {
    const x = b.rng.range(10, 390);
    const y = b.rng.range(10, 490);
    const s = b.rng.range(1.5, 4);
    b.detail([[x - s, y], [x + s, y]], { o: 0.6 });
    b.detail([[x, y - s], [x, y + s]], { o: 0.6 });
  }
}

export function planets(b: ArtBuilder, variant: number): void {
  b.region("sky", "space", rect(0, 0, 400, 500));
  starfield(b, 10 + Math.round(b.complexity * 20));
  switch (variant) {
    case 0:
      b.region("ring", "far ring", ellipseBand(200, 250, [190, 48], [140, 32], PI, PI * 2, -0.25));
      b.region("planet", "giant", circle(200, 250, 104, 64), { focal: true });
      b.shade(circle(200, 250, 100, 32), 0.1, 0.5);
      b.region("ring", "near ring", ellipseBand(200, 250, [190, 48], [140, 32], 0, PI, -0.25));
      break;
    case 1:
      b.region("planet", "home world", clipToBox(circle(70, 470, 200, 64), ART));
      for (const [rx, ry] of [[150, 60], [230, 90]] as const) b.detail(ellipse(250, 200, rx, ry, 48, -0.3), { closed: true, smooth: true, o: 0.45 });
      b.region("moon", "first moon", circle(300, 130, 40), { focal: true });
      b.region("moon", "second moon", circle(130, 170, 24));
      b.region("crater", "craters", [circle(290, 120, 8), circle(312, 144, 6), circle(126, 176, 5)]);
      break;
    case 2: {
      b.region("planet", "surface", circle(200, 250, 150, 64));
      b.region("shadow", "night side", [...arc(200, 250, 150, 150, -PI / 2, PI / 2, 24), ...arc(200, 250, 80, 150, PI / 2, -PI / 2, 24)], { smooth: true });
      const craters = Array.from({ length: 4 + Math.round(b.complexity * 6) }, () => ellipse(b.rng.range(110, 260), b.rng.range(140, 360), b.rng.range(8, 24), b.rng.range(6, 16), 20));
      b.region("crater", "craters", craters, { smooth: true, focal: true });
      break;
    }
    case 3: {
      const body = circle(200, 250, 150, 72);
      [0, 1, 2, 3, 4].forEach((i) => b.region("band", `band ${i + 1}`, clipToBox(body, { x: 0, y: 100 + i * 60, w: 400, h: 60 })));
      b.region("core", "storm eye", ellipse(250, 290, 44, 20, 32), { smooth: true, focal: true });
      b.detail(arc(250, 290, 30, 12, 0, PI * 3, 30), { smooth: true });
      break;
    }
    default:
      [70, 110, 150, 185].forEach((r) => b.detail(ellipse(200, 250, r, r * 0.8, 56), { closed: true, smooth: true, o: 0.5 }));
      b.region("core", "sun", circle(200, 250, 34), { focal: true });
      [[270, 250, 10], [200, 162, 14], [60, 290, 18], [320, 360, 12]].forEach(([x, y, r], i) => b.region("planet", `planet ${i + 1}`, circle(x, y, r)));
      b.region("ring", "ring", ellipseBand(60, 290, [34, 9], [24, 6], 0, PI * 2, 0.3));
  }
}

export function geometry(b: ArtBuilder, variant: number): void {
  switch (variant) {
    case 0: {
      const r = 34;
      const groups: Poly[][] = [[], [], []];
      for (let row = -1; row < 10; row++)
        for (let col = -1; col < 8; col++) {
          const x = col * r * 1.732 + (row % 2 ? r * 0.866 : 0);
          const y = row * r * 1.5;
          const hex = clipToBox(regular(x, y, r - 2, 6, PI / 6), ART);
          if (hex.length > 2) groups[(((col + row) % 3) + 3) % 3].push(hex);
        }
      ["first", "second", "third"].forEach((name, i) => b.region("tile", `${name} tiles`, groups[i], { focal: i === 0 }));
      break;
    }
    case 1: {
      const phi = 1.618;
      let size = 220;
      let x = 20;
      let y = 140;
      const squares: [number, number, number][] = [];
      for (let i = 0; i < 7; i++) {
        squares.push([x, y, size]);
        const next = size / phi;
        if (i % 4 === 0) x += size;
        else if (i % 4 === 1) { y += size; x += size - next; }
        else if (i % 4 === 2) { x -= next; y += size - next; }
        else { y -= next; }
        size = next;
      }
      squares.forEach(([sx, sy, s], i) => b.region("square", `square ${i + 1}`, rect(sx, sy, s, s), { focal: i === 0 }));
      b.line(squares.flatMap(([sx, sy, s], i) => {
        const corners: Pt[] = [[sx + s, sy + s], [sx, sy + s], [sx, sy], [sx + s, sy]];
        const [cx, cy] = corners[i % 4];
        return arc(cx, cy, s, s, PI + (i % 4) * (PI / 2), PI * 1.5 + (i % 4) * (PI / 2), 10);
      }), { smooth: true, w: 2 });
      break;
    }
    case 2: {
      const c: Pt = [150, 280];
      const s = 90;
      b.region("facet", "cube top", [[c[0], c[1] - s], [c[0] + s * 0.87, c[1] - s * 0.5], [c[0], c[1]], [c[0] - s * 0.87, c[1] - s * 0.5]], { focal: true });
      b.region("facet", "cube left", [[c[0] - s * 0.87, c[1] - s * 0.5], [c[0], c[1]], [c[0], c[1] + s], [c[0] - s * 0.87, c[1] + s * 0.5]]);
      b.region("facet", "cube right", [[c[0], c[1]], [c[0] + s * 0.87, c[1] - s * 0.5], [c[0] + s * 0.87, c[1] + s * 0.5], [c[0], c[1] + s]]);
      b.region("facet", "pyramid light", [[300, 120], [260, 260], [310, 280]]);
      b.region("facet", "pyramid dark", [[300, 120], [310, 280], [360, 250]]);
      b.detail(regular(280, 400, 60, 5), { closed: true, o: 0.4 });
      b.detail(star(280, 400, 60, 24, 5), { closed: true, o: 0.3 });
      break;
    }
    case 3:
      for (const [cx, cy, set] of [[180, 240, "first"], [230, 270, "second"]] as const) {
        const rings: Poly[] = [];
        for (let r = 20; r < 180; r += 36) {
          rings.push([...arc(cx, cy, r + 14, r + 14, 0, PI, 20), ...arc(cx, cy, r, r, PI, 0, 20)]);
          rings.push([...arc(cx, cy, r + 14, r + 14, PI, PI * 2, 20), ...arc(cx, cy, r, r, PI * 2, PI, 20)]);
        }
        b.region("ring", `${set} rings`, rings, { focal: set === "first" });
      }
      break;
    default: {
      const count = 10 + Math.round(b.complexity * 10);
      for (let i = 0; i < count; i++) {
        const cx = b.rng.range(40, 360);
        const cy = b.rng.range(40, 460);
        const sides = b.rng.pick([3, 3, 4]);
        b.region("shard", `shard ${i + 1}`, transform(blob(b.rng, 0, 0, b.rng.range(20, 60), sides, 0.3), { tx: cx, ty: cy, rot: b.rng.range(0, PI) }), { focal: i === 0 });
      }
    }
  }
}

export function symbols(b: ArtBuilder, variant: number): void {
  const cx = 200;
  const cy = 250;
  const ringSectors = (r0: number, r1: number, n = 4): Poly[] =>
    Array.from({ length: n }, (_, i) => [...arc(cx, cy, r1, r1, (i / n) * PI * 2 + 0.03, ((i + 1) / n) * PI * 2 - 0.03, 12), ...arc(cx, cy, r0, r0, ((i + 1) / n) * PI * 2 - 0.03, (i / n) * PI * 2 + 0.03, 12)]);
  switch (variant) {
    case 0:
      b.region("ring", "outer ring", ringSectors(150, 170));
      b.region("star", "pentagram", star(cx, cy, 146, 56, 5));
      b.region("core", "heart", regular(cx, cy, 52, 5, PI / 2), { focal: true });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI * 2;
        const [x, y] = [cx + Math.cos(a) * 185, cy + Math.sin(a) * 185];
        b.detail(transform([[-6, -8], [6, -8], [0, 0], [6, 8]], { tx: x, ty: y, rot: a }));
      }
      break;
    case 1: {
      const pointHalves = (len: number, width: number, offset: number) => {
        const light: Poly[] = [];
        const dark: Poly[] = [];
        for (let i = 0; i < 4; i++) {
          const a = offset + (i / 4) * PI * 2;
          const tip: Pt = [cx + Math.cos(a) * len, cy + Math.sin(a) * len];
          const l: Pt = [cx + Math.cos(a - PI / 2) * width, cy + Math.sin(a - PI / 2) * width];
          const r: Pt = [cx + Math.cos(a + PI / 2) * width, cy + Math.sin(a + PI / 2) * width];
          light.push([[cx, cy], l, tip]);
          dark.push([[cx, cy], tip, r]);
        }
        return [light, dark];
      };
      const [dl, dd] = pointHalves(110, 20, PI / 4);
      b.region("point", "minor points light", dl);
      b.region("point", "minor points dark", dd);
      const [ml, md] = pointHalves(180, 30, -PI / 2);
      b.region("point", "cardinal light", ml, { focal: true });
      b.region("point", "cardinal dark", md);
      b.region("core", "centre", circle(cx, cy, 16));
      b.detail(circle(cx, cy, 140, 60), { closed: true, o: 0.5 });
      break;
    }
    case 2:
      b.region("ray", "long rays", Array.from({ length: 8 }, (_, i) => petal(cx, cy, 190, 20, (i / 8) * PI * 2)), { focal: true });
      b.region("ray", "short rays", Array.from({ length: 8 }, (_, i) => petal(cx, cy, 130, 16, ((i + 0.5) / 8) * PI * 2)));
      b.region("ring", "wheel", ringSectors(70, 90, 8));
      b.region("core", "sun disc", circle(cx, cy, 60), { focal: true });
      break;
    case 3:
      for (let i = 0; i <= 8; i++) {
        b.detail([[i * 50, 0], [i * 50, 500]], { o: 0.3 });
        b.detail([[0, i * 62.5], [400, i * 62.5]], { o: 0.3 });
      }
      b.region("triangle", "pyramid", [[cx, 70], [360, 390], [40, 390]]);
      b.region("eye", "eye", [...arc(cx, 290, 90, 60, PI * 1.15, PI * 1.85, 14), ...arc(cx, 210, 90, 60, PI * 0.15, PI * 0.85, 14)], { smooth: true });
      b.region("iris", "iris", circle(cx, 250, 26), { focal: true });
      for (let i = 0; i < 12; i++) {
        const a = -PI / 2 + (i - 5.5) * 0.14;
        b.detail([[cx + Math.cos(a) * 200, 70 + Math.sin(a) * 200 + 200], [cx + Math.cos(a) * 250, 70 + Math.sin(a) * 250 + 200]], { o: 0.5 });
      }
      break;
    default:
      [[160, 210], [240, 210], [200, 290]].forEach(([x, y], i) => {
        const pieces = Array.from({ length: 6 }, (_, k) => [...arc(x, y, 90, 90, (k / 6) * PI * 2 + 0.05, ((k + 1) / 6) * PI * 2 - 0.05, 10), ...arc(x, y, 70, 70, ((k + 1) / 6) * PI * 2 - 0.05, (k / 6) * PI * 2 + 0.05, 10)] as Poly);
        b.region("ring", `loop ${i + 1}`, pieces, { focal: i === 2 });
      });
      b.region("core", "knot heart", regular(cx, 238, 20, 3, PI / 2));
  }
}

export function surreal(b: ArtBuilder, variant: number): void {
  switch (variant) {
    case 0: {
      b.region("cloud", "clouds", [ellipse(90, 440, 80, 26, 24), ellipse(300, 460, 100, 24, 24)], { smooth: true });
      const tops: Poly[] = [];
      const sides: Poly[] = [];
      for (let i = 0; i < 7; i++) {
        const x = 50 + i * 42;
        const y = 400 - i * 46 + Math.sin(i) * 8;
        tops.push([[x, y], [x + 60, y - 10], [x + 80, y + 4], [x + 20, y + 14]]);
        sides.push([[x + 20, y + 14], [x + 80, y + 4], [x + 80, y + 24], [x + 20, y + 34]]);
      }
      b.region("step", "treads", tops);
      b.region("shadow", "risers", sides);
      b.region("door", "door", rect(320, 40, 44, 76), { focal: true });
      break;
    }
    case 1:
      b.region("wood", "ledge", [[40, 300], [360, 300], [380, 340], [20, 340]]);
      b.region("wood", "table leg", rect(60, 340, 24, 150));
      b.region("dial", "melting clock", [...arc(180, 220, 110, 90, PI * 0.95, PI * 2.05, 24), [290, 300], [300, 380], [285, 420], [270, 370], [250, 300], [150, 305], [120, 300]], { smooth: true, focal: true });
      b.region("needle", "hands", [ribbon([[180, 225], [180, 160]], 8, 2), ribbon([[180, 225], [230, 250]], 8, 2)]);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * PI * 2;
        b.detail([[180 + Math.cos(a) * 80, 220 + Math.sin(a) * 65], [180 + Math.cos(a) * 90, 220 + Math.sin(a) * 72]]);
      }
      break;
    case 2:
      b.region("sky", "sky", rect(0, 0, 400, 300));
      b.region("moon", "moon", circle(90, 90, 24));
      b.region("water", "sea", rect(0, 300, 400, 200));
      b.region("light", "light path", [[170, 300], [230, 300], [300, 500], [100, 500]], { focal: true });
      b.region("frame", "door frame", rect(150, 140, 100, 170));
      b.region("portal", "doorway", rect(165, 155, 70, 150), { focal: true });
      for (let y = 330; y < 490; y += 30) b.detail(wave(10, 390, y, 3, 5, y, 30), { smooth: true, o: 0.35 });
      break;
    case 3:
      b.region("moon", "moon", circle(260, 160, 110, 56));
      b.region("vessel", "moon jar", lathe(180, 180, 260, [40, 46, 110, 128, 118, 80, 50]), { smooth: true, focal: true });
      b.line([[20, 440], [380, 440]]);
      b.detail([[150, 250], [170, 300], [160, 340]], { smooth: true, o: 0.7 });
      break;
    default:
      b.region("cloud", "cloud", Array.from({ length: 64 }, (_, i) => {
        const a = (i / 64) * PI * 2;
        const r = 90 + Math.abs(Math.sin(a * 3)) * 30;
        return [200 + Math.cos(a) * r * 1.5, 120 + Math.sin(a) * r * 0.6] as Pt;
      }), { smooth: true });
      b.region("skin", "hand", [[160, 160], [240, 160], [250, 280], [150, 280]], { smooth: true });
      [150, 180, 210, 240].forEach((x, i) => b.region("finger", `finger ${i + 1}`, capsule([x + 6, 270], [x + 6 + (i - 1.5) * 8, 350 - Math.abs(i - 1.5) * 12], 12, 10), { smooth: true }));
      b.region("planet", "falling world", circle(200, 430, 40), { focal: true });
      b.detail(petal(200, 470, 30, 6, PI / 2), { closed: true, o: 0.4 });
  }
}
