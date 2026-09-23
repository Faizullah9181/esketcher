import {
  arc,
  capsule,
  circle,
  clipToBox,
  ellipse,
  gear,
  lathe,
  petal,
  rect,
  ribbon,
  transform,
  wave,
  type Poly,
  type Pt,
} from "@/lib/geometry";

import type { ArtBuilder } from "../builder";

const PI = Math.PI;

function windows(x: number, y: number, w: number, h: number, cols: number, rows: number, keep: () => boolean): Poly[] {
  const out: Poly[] = [];
  const cw = w / cols;
  const ch = h / rows;
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) if (keep()) out.push(rect(x + c * cw + cw * 0.22, y + r * ch + ch * 0.2, cw * 0.56, ch * 0.55));
  return out;
}

export function architecture(b: ArtBuilder, variant: number): void {
  b.region("sky", "sky", rect(0, 0, 400, 500));
  switch (variant) {
    case 0: {
      const blocks: [number, number, number, number][] = [
        [60, 330, 280, 150],
        [100, 220, 230, 110],
        [80, 140, 170, 80],
        [180, 70, 120, 70],
      ];
      blocks.forEach(([x, y, w, h], i) => b.region("building", `block ${i + 1}`, rect(x, y, w, h)));
      b.region("window", "windows", blocks.flatMap(([x, y, w, h]) => windows(x, y, w, h, Math.round(w / 34), Math.round(h / 34), () => b.rng.chance(0.75))), { focal: true });
      b.line([[0, 480], [400, 480]], { w: 2 });
      break;
    }
    case 1: {
      const count = 5;
      const w = 360 / count;
      b.region("building", "entablature", rect(20, 110, 360, 50));
      b.region("building", "pillars", Array.from({ length: count + 1 }, (_, i) => rect(20 + i * w - 9, 160, 18, 260)));
      b.region("window", "arches", Array.from({ length: count }, (_, i) => [...arc(20 + i * w + w / 2, 230, w / 2 - 9, w / 2 - 9, PI, PI * 2, 14), [20 + (i + 1) * w - 9, 420], [20 + i * w + 9, 420]] as Poly), { focal: true });
      [0, 1, 2].forEach((i) => b.region("step", `step ${i + 1}`, rect(20 - i * 10, 420 + i * 22, 360 + i * 20, 22)));
      break;
    }
    case 2:
      b.region("water", "sea", [...wave(0, 400, 430, 6, 3, 0, 24), [400, 500], [0, 500]]);
      b.region("light", "beams", [[[200, 110], [0, 40], [0, 150]], [[200, 110], [400, 40], [400, 150]]], { focal: true });
      b.region("stripe", "red bands", [0, 2].map((i) => [[150 + i * 7, 150 + i * 70], [250 - i * 7, 150 + i * 70], [250 - (i + 1) * 7, 150 + (i + 1) * 70], [150 + (i + 1) * 7, 150 + (i + 1) * 70]] as Poly));
      b.region("stripe", "white bands", [1, 3].map((i) => [[150 + i * 7, 150 + i * 70], [250 - i * 7, 150 + i * 70], [250 - (i + 1) * 7, 150 + (i + 1) * 70], [150 + (i + 1) * 7, 150 + (i + 1) * 70]] as Poly));
      b.region("window", "lamp room", rect(165, 90, 70, 60), { focal: true });
      b.region("roof", "dome", [...arc(200, 90, 44, 36, PI, PI * 2, 16)], { smooth: true });
      b.region("rock", "rocks", [ellipse(130, 440, 60, 26, 20), ellipse(270, 445, 70, 24, 20)], { smooth: true });
      break;
    case 3: {
      b.region("moon", "moon", circle(320, 80, 26), { focal: true });
      const walls: Poly[] = [];
      const roofs: Poly[] = [];
      for (let i = 0; i < 4; i++) {
        const w = 180 - i * 34;
        const y = 420 - i * 84;
        walls.push(rect(200 - w / 2, y - 60, w, 60));
        const eave = w / 2 + 36;
        roofs.push([[200 - eave - 10, y - 50], [200 - w / 2, y - 72], [200 + w / 2, y - 72], [200 + eave + 10, y - 50], [200 + eave - 10, y - 62], [200 - eave + 10, y - 62]]);
      }
      b.region("building", "walls", walls);
      b.region("roof", "roofs", roofs, { smooth: true });
      b.region("spire", "spire", [[196, 90], [204, 90], [200, 30]]);
      b.line([[0, 420], [400, 420]], { w: 2 });
      break;
    }
    default: {
      b.region("moon", "moon", circle(90, 90, 30), { focal: true });
      let x = 0;
      const towers: Poly[] = [];
      const lit: Poly[] = [];
      while (x < 400) {
        const w = b.rng.range(34, 70);
        const h = b.rng.range(120, 330);
        towers.push(rect(x, 480 - h, w, h));
        lit.push(...windows(x, 490 - h, w, h - 20, Math.max(2, Math.round(w / 16)), Math.round(h / 22), () => b.rng.chance(0.28)));
        if (b.rng.chance(0.3)) b.line([[x + w / 2, 480 - h], [x + w / 2, 450 - h]]);
        x += w + b.rng.range(2, 8);
      }
      b.region("building", "towers", towers);
      b.region("window", "lit windows", lit, { focal: true });
      b.line([[0, 480], [400, 480]], { w: 2 });
    }
  }
}

export function mechanical(b: ArtBuilder, variant: number): void {
  const spokes = (cx: number, cy: number, r: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2;
      b.detail([[cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3], [cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8]]);
    }
  };
  switch (variant) {
    case 0: {
      const gears: [number, number, number, number][] = [[150, 200, 90, 16], [262, 272, 56, 10], [180, 372, 64, 12], [300, 150, 40, 8]];
      gears.forEach(([x, y, r, t], i) => {
        b.region("gear", `gear ${i + 1}`, gear(x, y, r, t, 12, i * 0.2));
        b.region("core", `hub ${i + 1}`, circle(x, y, r * 0.22), { focal: i === 0 });
        spokes(x, y, r - 12, 6);
      });
      break;
    }
    case 1:
      b.region("block", "cylinder block", rect(110, 220, 180, 230));
      b.region("core", "chamber", [...arc(170, 270, 40, 40, PI, PI * 2, 12), ...arc(230, 270, 40, 40, PI, PI * 2, 12), [200, 360]], { smooth: true, focal: true });
      b.region("piston", "piston", rect(150, 120, 100, 70));
      b.region("rod", "rod", rect(188, 60, 24, 60));
      b.region("gear", "flywheel", gear(200, 40, 34, 10, 8));
      for (let i = 0; i < 5; i++) b.detail([[110, 400 + i * 10], [290, 400 + i * 10]]);
      break;
    case 2:
      [[300, 110, 60, 12], [100, 400, 70, 14], [320, 400, 44, 9]].forEach(([x, y, r, t], i) => b.region("gear", `gear ${i + 1}`, gear(x, y, r, t, 10)));
      b.region("dial", "clock face", circle(200, 250, 140, 64));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * PI * 2;
        b.line([[200 + Math.cos(a) * 118, 250 + Math.sin(a) * 118], [200 + Math.cos(a) * 134, 250 + Math.sin(a) * 134]], { w: i % 3 ? 1.4 : 3 });
      }
      b.region("needle", "hands", [ribbon([[200, 250], [200, 140]], 10, 2), ribbon([[200, 250], [280, 290]], 12, 3)], { focal: true });
      b.region("core", "pivot", circle(200, 250, 9));
      break;
    case 3:
      b.region("housing", "housing", [0, 1, 2, 3].map((i) => [...arc(200, 250, 170, 170, (i * PI) / 2 + 0.02, ((i + 1) * PI) / 2 - 0.02, 12), ...arc(200, 250, 150, 150, ((i + 1) * PI) / 2 - 0.02, (i * PI) / 2 + 0.02, 12)] as Poly));
      for (const [set, offset] of [["odd", 0], ["even", 1]] as const)
        b.region("blade", `${set} blades`, Array.from({ length: 6 }, (_, i) => petal(200, 250, 146, 30, ((i * 2 + offset) / 12) * PI * 2 + 0.2)), { smooth: true });
      b.region("core", "hub", circle(200, 250, 30), { focal: true });
      break;
    default: {
      b.region("block", "base", [[120, 480], [280, 480], [250, 430], [150, 430]]);
      const joints: Pt[] = [[200, 420], [150, 290], [260, 180], [310, 250]];
      for (let i = 0; i < 3; i++) b.region("arm", `segment ${i + 1}`, capsule(joints[i], joints[i + 1], 20 - i * 4, 16 - i * 3), { smooth: true });
      joints.slice(0, 3).forEach(([x, y], i) => b.region("joint", `joint ${i + 1}`, circle(x, y, 18 - i * 3), { focal: i === 1 }));
      b.region("claw", "claw", [petal(310, 250, 50, 10, 1.1), petal(310, 250, 50, 10, 2.2)], { smooth: true });
      b.detail([[200, 420], [120, 380], [150, 300]], { smooth: true, o: 0.6 });
    }
  }
}

export function objects(b: ArtBuilder, variant: number): void {
  switch (variant) {
    case 0: {
      for (let i = 0; i < 3; i++) {
        b.line([[190 + i * 10, 150], [150 + i * 50, 60]], { smooth: true, w: 1.6 });
        b.region("petal", `bloom ${i + 1}`, circle(150 + i * 50, 58, 16), { focal: true });
      }
      b.region("shadow", "shadow", ellipse(200, 462, 130, 16, 30), { smooth: true });
      const vase = lathe(200, 140, 320, [34, 26, 40, 90, 110, 104, 80, 60]);
      b.region("vessel", "vase", vase, { smooth: true });
      b.region("band", "bands", [clipToBox(vase, { x: 0, y: 270, w: 400, h: 26 }), clipToBox(vase, { x: 0, y: 330, w: 400, h: 14 })]);
      b.line([[20, 460], [380, 460]]);
      break;
    }
    case 1:
      b.region("vessel", "saucer", ellipse(200, 400, 170, 36, 40), { smooth: true });
      b.region("handle", "handle", ribbon(arc(300, 300, 50, 50, -PI / 2.4, PI / 2.4, 16), 16), { smooth: true });
      b.region("vessel", "cup", lathe(200, 220, 170, [130, 126, 114, 96, 70]), { smooth: true });
      b.region("water", "tea", ellipse(200, 222, 128, 24, 40), { smooth: true, focal: true });
      for (let i = 0; i < 3; i++) {
        const steam = Array.from({ length: 6 }, (_, k) => [170 + i * 30 + Math.sin(k * 1.3 + i) * 8, 180 - k * 20] as Pt);
        b.line(steam, { smooth: true, o: 0.7 });
      }
      break;
    case 2: {
      const bottles: [number, number[], number][] = [[100, [12, 12, 30, 44, 44, 44], 140], [210, [14, 14, 18, 56, 56, 56, 52], 90], [320, [10, 10, 34, 40, 38, 40], 170]];
      bottles.forEach(([x, widths, top], i) => {
        b.region("cork", `cork ${i + 1}`, rect(x - widths[0], top - 18, widths[0] * 2, 20));
        const shape = lathe(x, top, 440 - top, widths);
        b.region("vessel", `bottle ${i + 1}`, shape, { smooth: true });
        b.region("label", `label ${i + 1}`, clipToBox(shape, { x: 0, y: 330, w: 400, h: 50 }), { focal: i === 1 });
      });
      b.line([[20, 442], [380, 442]]);
      break;
    }
    case 3:
      b.region("light", "light cone", [[240, 210], [110, 470], [390, 470]], { focal: true });
      b.region("block", "base", ellipse(110, 460, 70, 16, 30), { smooth: true });
      b.region("arm", "arms", [ribbon([[110, 450], [80, 300]], 10), ribbon([[80, 300], [200, 170]], 10)]);
      b.region("joint", "joints", [circle(80, 300, 12), circle(200, 170, 12)]);
      b.region("shade", "shade", transform([[-40, 0], [40, 0], [70, 80], [-70, 80]], { tx: 230, ty: 150, rot: -0.5 }));
      b.region("core", "bulb", circle(262, 214, 16), { focal: true });
      break;
    default:
      b.region("wood", "back", [[130, 80], [270, 80], [270, 260], [130, 260]]);
      b.region("slat", "slats", [0, 1, 2].map((i) => rect(150 + i * 40, 100, 20, 150)));
      b.region("wood", "legs", [rect(130, 300, 16, 170), rect(254, 300, 16, 170), rect(160, 300, 12, 140), rect(230, 300, 12, 140)]);
      b.region("wood", "seat", [[110, 260], [290, 260], [310, 310], [90, 310]]);
      b.region("fabric", "cushion", [[125, 250], [275, 250], [290, 285], [110, 285]], { smooth: true, focal: true });
  }
}

type Glyph = (number[] | Poly)[];
// Bars on a 4×6 grid: [x, y, w, h], or a polygon in the same units.
const GLYPHS: Record<string, Glyph> = {
  P: [[0, 0, 1, 6], [0, 0, 4, 1], [3, 0, 1, 3], [0, 2.2, 4, 1]],
  A: [[0, 1, 1, 5], [3, 1, 1, 5], [0, 0, 4, 1.2], [0, 3, 4, 1]],
  I: [[1.5, 0, 1, 6], [0, 0, 4, 1], [0, 5, 4, 1]],
  N: [[0, 0, 1, 6], [3, 0, 1, 6], [[0.4, 0], [1.6, 0], [3.6, 6], [2.4, 6]]],
  T: [[0, 0, 4, 1], [1.5, 0, 1, 6]],
  G: [[0, 0, 4, 1], [0, 0, 1, 6], [0, 5, 4, 1], [3, 3, 1, 3], [2, 3, 2, 1]],
  L: [[0, 0, 1, 6], [0, 5, 4, 1]],
  O: [[0, 0, 4, 1], [0, 5, 4, 1], [0, 0, 1, 6], [3, 0, 1, 6]],
  W: [[0, 0, 1, 6], [3, 0, 1, 6], [0, 5, 4, 1], [1.5, 2.4, 1, 3.6]],
  E: [[0, 0, 1, 6], [0, 0, 4, 1], [0, 2.5, 3, 1], [0, 5, 4, 1]],
  J: [[0, 0, 4, 1], [2.5, 0, 1, 6], [0, 5, 3.5, 1], [0, 3.5, 1, 2.5]],
  V: [[[0, 0], [1, 0], [2.5, 6], [1.5, 6]], [[3, 0], [4, 0], [2.5, 6], [1.5, 6]]],
  S: [[0, 0, 4, 1], [0, 0, 1, 3], [0, 2.5, 4, 1], [3, 2.5, 1, 3.5], [0, 5, 4, 1]],
};

const WORDS = ["PAINT", "GLOW", "WET", "JEV", "NOISE"];

export function typography(b: ArtBuilder, variant: number): void {
  const word = WORDS[variant % WORDS.length];
  const unit = Math.min(360 / (word.length * 5 - 1), 26);
  const width = (word.length * 5 - 1) * unit;
  const x0 = 200 - width / 2;
  const y0 = 250 - unit * 3;
  b.region("panel", "backdrop", [[x0 - 30, y0 - 50], [x0 + width + 30, y0 - 70], [x0 + width + 40, y0 + unit * 6 + 50], [x0 - 20, y0 + unit * 6 + 70]], { smooth: false });
  word.split("").forEach((letter, i) => {
    const polys = (GLYPHS[letter] ?? GLYPHS.O).map((part) => {
      const poly: Poly = typeof part[0] === "number" ? rect(...(part as [number, number, number, number])) : (part as Poly);
      return transform(poly, { tx: x0 + i * 5 * unit, ty: y0, sx: unit });
    });
    b.region("letter", `letter ${letter}`, polys, { focal: i === 0 });
    if (b.detailed(0.45)) for (const p of polys) b.detail(transform(p, { tx: 6, ty: 6 }), { closed: true, o: 0.35 });
  });
  b.line([[x0 - 10, y0 + unit * 6 + 24], [x0 + width + 10, y0 + unit * 6 + 24]], { w: 2.4 });
  for (let i = 0; i < 5; i++) b.detail(circle(b.rng.range(40, 360), b.rng.range(40, 120), 3, 8), { closed: true });
}
