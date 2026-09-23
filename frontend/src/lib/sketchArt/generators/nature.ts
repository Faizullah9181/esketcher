import {
  arc,
  blob,
  capsule,
  circle,
  clipToBox,
  curve,
  ellipse,
  mirrorX,
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

function stem(b: ArtBuilder, from: Pt, to: Pt, bend = 30): Poly {
  const line = curve([from, [(from[0] + to[0]) / 2 + bend, (from[1] + to[1]) / 2], to], 20);
  b.line(line, { smooth: true, w: 2.2 });
  return line;
}

function ring(b: ArtBuilder, cx: number, cy: number, count: number, len: number, width: number, offset: number, label: string, focal = false) {
  const petals = Array.from({ length: count }, (_, i) => {
    const a = offset + (i / count) * PI * 2;
    return petal(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, len, width, a);
  });
  petals.forEach((p, i) => b.region("petal", `${label} ${i + 1}`, p, { smooth: true, focal }));
}

export function flowers(b: ArtBuilder, variant: number): void {
  const cx = 200;
  const cy = 200;
  if (variant !== 3) {
    const s = stem(b, [cx, cy + 40], [cx - 10, 490], 26);
    b.region("leaf", "left leaf", petal(s[12][0], s[12][1], 90, 26, PI * 0.85), { smooth: true });
    b.region("leaf", "right leaf", petal(s[15][0], s[15][1], 80, 22, PI * 0.1), { smooth: true });
  }
  switch (variant) {
    case 0:
      ring(b, cx, cy, 8, 120, 28, 0, "outer petal");
      ring(b, cx, cy, 8, 78, 20, PI / 8, "inner petal");
      b.region("core", "heart", circle(cx, cy, 24), { focal: true });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI * 2;
        b.detail([[cx, cy], [cx + Math.cos(a) * 52, cy + Math.sin(a) * 52]]);
      }
      break;
    case 1:
      ring(b, cx, cy, 22, 110, 11, 0, "ray petal");
      b.region("core", "disc", circle(cx, cy, 38), { focal: true });
      if (b.detailed(0.4)) for (let r = 8; r < 34; r += 8) b.detail(circle(cx, cy, r, 24), { closed: true, o: 0.4 });
      break;
    case 2:
      for (let i = 0; i < 6; i++) {
        const r = 104 - i * 17;
        b.region("petal", `layer ${i + 1}`, blob(b.rng, cx + b.rng.range(-6, 6), cy + i * 3, r, 7, 0.16), { smooth: true, focal: i > 3 });
      }
      b.detail(arc(cx, cy + 16, 12, 12, 0, PI * 3.2, 30).map(([x, y], i) => [x + i * 0.3, y] as Pt), { smooth: true });
      break;
    case 3: {
      b.region("water", "pond", [...wave(0, 400, 360, 6, 3, 0, 24), [400, 500], [0, 500]], { smooth: false });
      b.region("leaf", "lily pad", ellipse(200, 372, 150, 26, 40), { smooth: true });
      [-0.9, -0.45, 0, 0.45, 0.9].forEach((o, i) => b.region("petal", `back petal ${i + 1}`, petal(200, 350, 150, 34, -PI / 2 + o), { smooth: true }));
      [-0.6, -0.2, 0.2, 0.6].forEach((o, i) => b.region("petal", `front petal ${i + 1}`, petal(200, 356, 100, 30, -PI / 2 + o), { smooth: true, focal: true }));
      break;
    }
    default:
      [PI * 0.25, PI * 0.75, PI * 1.25, PI * 1.75].forEach((a, i) =>
        b.region("petal", `petal ${i + 1}`, blob(b.rng, cx + Math.cos(a) * 60, cy + Math.sin(a) * 60, 72, 10, 0.12), { smooth: true }),
      );
      b.region("core", "seed pod", circle(cx, cy, 30), { focal: true });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2;
        b.detail([[cx, cy], [cx + Math.cos(a) * 28, cy + Math.sin(a) * 28]]);
      }
      stem(b, [260, 300], [300, 490], -20);
      b.region("petal", "bud", ellipse(262, 290, 16, 24, 20, 0.4), { smooth: true });
  }
}

export function botanical(b: ArtBuilder, variant: number): void {
  switch (variant) {
    case 0: {
      const spine = curve([[200, 480], [150, 300], [260, 160], [220, 40]], 40);
      b.line(spine, { smooth: true, w: 2.4 });
      const left: Poly[] = [];
      const right: Poly[] = [];
      for (let i = 2; i < spine.length - 2; i += 2) {
        const [x, y] = spine[i];
        const [nx, ny] = spine[i + 1];
        const a = Math.atan2(ny - y, nx - x);
        const len = 90 * (1 - i / spine.length) + 14;
        left.push(petal(x, y, len, len * 0.22, a - PI / 2.6));
        right.push(petal(x, y, len, len * 0.22, a + PI / 2.6));
      }
      b.region("leaf", "left fronds", left, { smooth: true });
      b.region("leaf", "right fronds", right, { smooth: true, focal: true });
      break;
    }
    case 1: {
      stem(b, [200, 330], [210, 490], -20);
      const base: Pt = [200, 330];
      const lobes = [-2.7, -2.25, -1.85, -1.5, -1.2, -0.85, -0.45];
      lobes.forEach((a, i) => b.region("leaf", `lobe ${i + 1}`, petal(base[0], base[1], 210 - Math.abs(i - 3) * 22, 36, a), { smooth: true, focal: i === 3 }));
      if (b.detailed(0.4)) for (let i = 0; i < 5; i++) b.detail(ellipse(150 + i * 25, 190 + (i % 2) * 40, 7, 12, 12), { closed: true, smooth: true });
      break;
    }
    case 2: {
      const pod = ellipse(200, 250, 90, 190, 48, 0.25);
      b.region("pod", "husk", pod, { smooth: true });
      b.region("core", "cavity", ellipse(200, 250, 48, 150, 40, 0.25), { smooth: true });
      const seeds = Array.from({ length: 7 }, (_, i) => circle(200 + Math.sin(0.25) * (i - 3) * -38, 250 + Math.cos(0.25) * (i - 3) * 38, 15, 20));
      b.region("seed", "seeds", seeds, { focal: true });
      b.line(curve([[240, 70], [300, 30], [330, 70], [300, 90]], 20), { smooth: true });
      break;
    }
    case 3:
      b.region("vessel", "pot", [[120, 400], [280, 400], [262, 490], [138, 490]]);
      b.region("soil", "soil", ellipse(200, 402, 80, 12, 30), { smooth: true });
      b.region("cactus", "left arm", ribbon([[170, 300], [120, 290], [110, 220], [115, 180]], 36, 30), { smooth: true });
      b.region("cactus", "right arm", ribbon([[230, 260], [280, 250], [290, 190], [286, 150]], 36, 30), { smooth: true });
      b.region("cactus", "column", capsule([200, 400], [200, 110], 44, 40), { smooth: true });
      for (let i = 0; i < 18; i++) {
        const x = 170 + (i % 3) * 30;
        const y = 150 + Math.floor(i / 3) * 42;
        b.detail([[x, y], [x - 8, y - 6]]);
        b.detail([[x, y], [x + 8, y - 6]]);
      }
      [0, 1, 2, 3, 4].forEach((i) => b.region("petal", "blossom", petal(200, 76, 34, 11, -PI / 2 + (i - 2) * 0.5), { smooth: true, focal: true }));
      break;
    default: {
      [0, 1, 2].forEach((i) => b.region("earth", `soil layer ${i + 1}`, [...wave(0, 400, 170 + i * 110, 6, 2, i, 20), [400, 500], [0, 500]], { smooth: false }));
      b.region("leaf", "sprout", [petal(200, 160, 70, 22, -PI * 0.75), petal(200, 160, 70, 22, -PI * 0.25)], { smooth: true, focal: true });
      const grow = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
        if (depth === 0 || len < 8) return;
        const end: Pt = [x + Math.cos(a) * len, y + Math.sin(a) * len];
        b.line([[x, y], [(x + end[0]) / 2 + b.rng.range(-6, 6), (y + end[1]) / 2], end], { smooth: true, w });
        const branches = b.detailed(0.6) ? 3 : 2;
        for (let k = 0; k < branches; k++) grow(end[0], end[1], a + b.rng.range(-0.7, 0.7), len * 0.72, w * 0.7, depth - 1);
      };
      grow(200, 170, PI / 2, 80, 3, 5);
      b.region("root", "tuber", ellipse(170, 330, 36, 26, 24, 0.4), { smooth: true });
      b.region("root", "second tuber", ellipse(250, 380, 26, 20, 24, -0.3), { smooth: true });
    }
  }
}

export function animals(b: ArtBuilder, variant: number): void {
  switch (variant) {
    case 0:
      b.region("fur", "body", blob(b.rng, 220, 310, 110, 12, 0.08), { smooth: true });
      b.region("tail", "tail", ribbon(arc(210, 330, 140, 120, PI * 0.1, PI * 0.95, 20), 30, 70), { smooth: true });
      b.region("tail", "tail tip", ellipse(80, 370, 34, 26, 20, 0.6), { smooth: true, focal: true });
      b.region("fur", "head", [[70, 250], [150, 205], [200, 250], [170, 300], [110, 300]], { smooth: true });
      b.region("ear", "ears", [[[95, 225], [100, 170], [130, 212]], [[140, 212], [165, 160], [175, 232]]]);
      b.line(arc(125, 255, 10, 4, 0.2, PI - 0.2, 6), { smooth: true });
      b.line(arc(160, 258, 10, 4, 0.2, PI - 0.2, 6), { smooth: true });
      break;
    case 1: {
      b.region("water", "pond", ellipse(200, 250, 190, 230, 48), { smooth: true });
      for (let r = 40; r < 170; r += 34) b.detail(circle(90, 400, r, 40), { closed: true, o: 0.3 });
      const body: Poly = [[110, 250], [150, 205], [240, 200], [300, 235], [320, 250], [300, 265], [240, 300], [150, 295]];
      b.region("fin", "tail fin", [petal(318, 250, 80, 30, -0.5), petal(318, 250, 80, 30, 0.5)], { smooth: true });
      b.region("fin", "pectoral fins", [petal(170, 290, 50, 16, 2.2), petal(170, 210, 50, 16, -2.2)], { smooth: true });
      b.region("scales", "body", body, { smooth: true });
      b.region("spot", "red patch", blob(b.rng, 200, 240, 30, 8, 0.3), { smooth: true, focal: true });
      b.region("eye", "eye", circle(140, 240, 7), { focal: true });
      if (b.detailed(0.45)) for (let x = 170; x < 290; x += 16) for (let y = 222; y < 280; y += 14) b.detail(arc(x, y, 8, 7, -PI / 2, PI / 2, 6), { smooth: true, o: 0.35 });
      break;
    }
    case 2:
      b.region("water", "shallows", [...wave(0, 400, 420, 5, 3, 0, 24), [400, 500], [0, 500]]);
      b.line([[210, 330], [200, 440]], { w: 2.2 });
      b.line([[235, 330], [250, 440]], { w: 2.2 });
      b.region("feathers", "body", ellipse(230, 300, 76, 40, 36, -0.35), { smooth: true });
      b.region("wing", "wing", petal(280, 280, -120, 30, -0.2), { smooth: true });
      b.region("neck", "neck", ribbon(curve([[180, 290], [130, 220], [200, 170], [170, 110]], 18), 20, 14), { smooth: true });
      b.region("head", "head", ellipse(165, 104, 22, 16, 20), { smooth: true });
      b.region("beak", "beak", [[150, 100], [70, 118], [150, 112]], { focal: true });
      for (let i = 0; i < 6; i++) b.detail([[40 + i * 60, 470], [44 + i * 60, 380 + b.rng.range(0, 40)]], { smooth: true });
      break;
    case 3:
      b.region("wood", "branch", capsule([30, 440], [380, 420], 16, 14), { smooth: true });
      b.region("wing", "left wing", petal(140, 230, 190, 40, PI / 2 + 0.2), { smooth: true });
      b.region("wing", "right wing", petal(260, 230, 190, 40, PI / 2 - 0.2), { smooth: true });
      b.region("feathers", "body", ellipse(200, 300, 95, 135, 44), { smooth: true });
      b.region("face", "facial disc", [...arc(165, 210, 52, 56, PI * 0.5, PI * 1.9, 18), ...arc(235, 210, 52, 56, PI * 1.1, PI * 2.5, 18)], { smooth: true });
      b.region("ear", "ear tufts", [[[140, 170], [130, 110], [170, 160]], [[260, 170], [270, 110], [230, 160]]]);
      b.region("eye", "left eye", circle(168, 212, 28), { focal: true });
      b.region("eye", "right eye", circle(232, 212, 28), { focal: true });
      b.region("iris", "pupils", [circle(168, 212, 11), circle(232, 212, 11)]);
      b.region("beak", "beak", [[190, 240], [210, 240], [200, 270]]);
      if (b.detailed(0.45)) for (let y = 290; y < 400; y += 20) for (let x = 150; x < 260; x += 22) b.detail(arc(x, y, 9, 6, 0.2, PI - 0.2, 6), { smooth: true, o: 0.4 });
      break;
    default:
      b.region("water", "sea", [...wave(0, 400, 330, 8, 2.5, 0, 30), [400, 500], [0, 500]]);
      b.region("fluke", "tail flukes", [petal(340, 170, 60, 20, -0.9), petal(340, 170, 60, 20, 0.3)], { smooth: true });
      b.region("whale", "body", [[40, 300], [60, 230], [150, 190], [260, 200], [330, 180], [345, 200], [300, 260], [200, 330], [90, 340]], { smooth: true });
      b.region("belly", "belly", [[60, 300], [200, 318], [290, 272], [200, 334], [90, 336]], { smooth: true });
      for (let i = 0; i < 5; i++) b.detail([[90 + i * 30, 310 + i * 1], [120 + i * 34, 300 - i * 4]], { o: 0.5 });
      b.region("eye", "eye", circle(100, 270, 6), { focal: true });
      b.region("water", "spout", [petal(120, 190, 90, 18, -PI / 2 - 0.3), petal(120, 190, 90, 18, -PI / 2 + 0.3)], { smooth: true });
  }
}

export function insects(b: ArtBuilder, variant: number): void {
  const cx = 200;
  const pair = (kind: string, label: string, p: Poly, opts = {}) => {
    b.region(kind, `left ${label}`, p, { smooth: true, ...opts });
    b.region(kind, `right ${label}`, mirrorX(p, cx), { smooth: true, ...opts });
  };
  switch (variant) {
    case 0:
      pair("wing", "forewing", petal(cx, 220, 175, 64, -PI + 0.5));
      pair("wing", "hindwing", petal(cx, 250, 130, 60, PI - 0.55));
      pair("eye", "eyespot", circle(120, 300, 20), { focal: true });
      b.region("body", "body", [ellipse(cx, 210, 16, 30, 20), ellipse(cx, 290, 13, 60, 24)], { smooth: true });
      b.line(curve([[cx - 6, 182], [170, 120], [140, 110]], 12), { smooth: true });
      b.line(curve([[cx + 6, 182], [230, 120], [260, 110]], 12), { smooth: true });
      break;
    case 1:
      b.region("head", "head", ellipse(cx, 120, 30, 24, 24), { smooth: true });
      b.region("shell", "pronotum", ellipse(cx, 168, 62, 34, 32), { smooth: true });
      pair("shell", "elytron", clipToBox(ellipse(cx, 300, 92, 130, 48), { x: 0, y: 0, w: cx - 2, h: 500 }), { focal: true });
      for (const [y, a] of [[190, -0.5], [240, 0], [290, 0.5]] as const) {
        b.line([[cx - 80, y], [cx - 130, y + a * 60 - 20], [cx - 150, y + a * 90 + 20]], { w: 2 });
        b.line([[cx + 80, y], [cx + 130, y + a * 60 - 20], [cx + 150, y + a * 90 + 20]], { w: 2 });
      }
      b.line([[cx - 10, 100], [150, 50]]);
      b.line([[cx + 10, 100], [250, 50]]);
      b.shade(ellipse(cx, 300, 88, 126, 32), 0.9, 0.5);
      break;
    case 2: {
      pair("wing", "forewing", petal(cx, 170, 180, 22, -PI + 0.18));
      pair("wing", "hindwing", petal(cx, 190, 170, 24, PI - 0.25));
      const segs = Array.from({ length: 10 }, (_, i) => ellipse(cx, 215 + i * 24, 9 - i * 0.3, 13, 16));
      b.region("body", "abdomen", segs, { smooth: true });
      b.region("body", "thorax", ellipse(cx, 180, 18, 26, 24), { smooth: true });
      b.region("eye", "compound eyes", [circle(cx - 14, 140, 15), circle(cx + 14, 140, 15)], { focal: true });
      break;
    }
    case 3:
      b.region("wing", "wings", petal(cx, 230, 190, 42, PI / 2), { smooth: true });
      b.region("body", "thorax", capsule([cx, 110], [cx, 230], 12, 14), { smooth: true });
      pair("arm", "raptor arm", ribbon([[cx - 10, 150], [130, 190], [150, 110], [120, 90]], 16, 8));
      b.region("head", "head", [[cx - 44, 70], [cx + 44, 70], [cx, 118]], { smooth: false });
      b.region("eye", "eyes", [circle(cx - 34, 76, 11), circle(cx + 34, 76, 11)], { focal: true });
      for (const y of [260, 300]) {
        b.line([[cx - 10, y], [120, y + 40], [110, y + 120]], { w: 1.8 });
        b.line([[cx + 10, y], [280, y + 40], [290, y + 120]], { w: 1.8 });
      }
      break;
    default:
      pair("wing", "forewing", [[cx, 190], [60, 110], [40, 170], [110, 260], [cx, 250]]);
      pair("wing", "hindwing", [[cx, 250], [110, 270], [90, 350], [120, 390], [110, 460], [150, 390], [cx, 320]]);
      pair("spot", "wing spots", circle(120, 330, 14), { focal: true });
      b.region("body", "body", capsule([cx, 170], [cx, 340], 10, 7), { smooth: true });
      if (b.detailed(0.4)) for (let i = 0; i < 5; i++) {
        b.detail([[cx - 10, 200 + i * 10], [70 + i * 12, 130 + i * 20]], { o: 0.4 });
        b.detail([[cx + 10, 200 + i * 10], [330 - i * 12, 130 + i * 20]], { o: 0.4 });
      }
  }
}

function ridge(b: ArtBuilder, y: number, amp: number, n: number): Poly {
  const pts: Poly = [[0, 500]];
  for (let i = 0; i <= n; i++) pts.push([(i / n) * 400, y - b.rng.range(0, amp) * (i % 2 ? 1 : 0.4)]);
  pts.push([400, 500]);
  return pts;
}

export function landscapes(b: ArtBuilder, variant: number): void {
  b.region("sky", "sky", rect(0, 0, 400, 500));
  switch (variant) {
    case 0:
      b.region("sun", "sun", circle(280, 150, 44), { focal: true });
      [180, 250, 330].forEach((y, i) => b.region("mountain", `ridge ${i + 1}`, ridge(b, y, 80 - i * 15, 8 + i * 2)));
      b.detail(wave(0, 400, 300, 4, 3, 0, 30), { smooth: true, o: 0.4 });
      break;
    case 1:
      b.region("sun", "sun", circle(110, 120, 52), { focal: true });
      [220, 290, 360, 430].forEach((y, i) => b.region("dune", `dune ${i + 1}`, [...wave(0, 400, y, 22, 1 + i * 0.3, i * 1.7, 30), [400, 500], [0, 500]], { smooth: true }));
      if (b.detailed(0.45)) for (let i = 0; i < 12; i++) b.detail(wave(40 + i * 25, 100 + i * 25, 300 + (i % 4) * 40, 3, 1, 0, 8), { smooth: true, o: 0.35 });
      break;
    case 2: {
      b.region("moon", "moon", circle(300, 90, 26), { focal: true });
      const mountain: Poly = [[0, 260], [90, 150], [150, 190], [230, 90], [310, 180], [400, 140], [400, 260]];
      b.region("mountain", "mountain", mountain);
      b.region("water", "lake", rect(0, 260, 400, 240));
      b.region("mountain", "reflection", mountain.map(([x, y]) => [x, 520 - y] as Pt), { focal: false });
      for (let y = 280; y < 480; y += 26) b.detail(wave(20, 380, y, 2, 4, y, 20), { smooth: true, o: 0.35 });
      break;
    }
    case 3:
      b.region("cloud", "smoke plume", [circle(210, 120, 50), circle(260, 80, 40), circle(170, 70, 34)], { smooth: true });
      b.region("mountain", "cone", [[20, 500], [160, 200], [240, 200], [380, 500]]);
      b.region("core", "crater", ellipse(200, 200, 40, 10, 24), { smooth: true, focal: true });
      b.region("flame", "lava flow", ribbon(curve([[210, 205], [250, 300], [200, 390], [240, 500]], 20), 16, 40), { smooth: true });
      break;
    default: {
      b.region("moon", "moon", circle(300, 100, 34), { focal: true });
      b.region("mountain", "far hills", [...wave(0, 400, 300, 16, 1.5, 0, 24), [400, 500], [0, 500]], { smooth: true });
      const pine = (x: number, base: number, h: number): Poly[] =>
        [0, 1, 2].map((k) => [[x - (h * 0.32 - k * 8), base - k * h * 0.25], [x, base - h + k * 6 - (2 - k) * h * 0.18], [x + (h * 0.32 - k * 8), base - k * h * 0.25]] as Poly);
      b.region("tree", "far pines", Array.from({ length: 6 }, (_, i) => pine(30 + i * 70, 330, 90)).flat());
      b.region("snow", "snowfield", [...wave(0, 400, 400, 8, 1, 1, 24), [400, 500], [0, 500]], { smooth: true });
      b.region("tree", "near pines", [pine(90, 450, 190), pine(310, 460, 170)].flat(), { focal: true });
    }
  }
}

export function creatures(b: ArtBuilder, variant: number): void {
  switch (variant) {
    case 0: {
      for (let i = 0; i < 7; i++) b.line(curve([[130 + i * 24, 260], [110 + i * 30, 360], [150 + i * 22, 470]], 18), { smooth: true, w: 1.2 });
      b.region("arm", "oral arms", [petal(170, 250, 200, 18, PI / 2 + 0.1), petal(230, 250, 200, 18, PI / 2 - 0.1)], { smooth: true });
      b.region("body", "bell", [...arc(200, 250, 130, 150, PI, PI * 2, 30), ...wave(330, 70, 250, 8, 5, 0, 30)], { smooth: true });
      b.region("core", "organs", [0, 1, 2, 3].map((i) => ellipse(150 + i * 33, 200, 12, 20, 18)), { smooth: true, focal: true });
      for (let i = 0; i < 6; i++) b.detail(circle(60 + b.rng.range(0, 280), 60 + b.rng.range(0, 120), b.rng.range(3, 8), 12), { closed: true });
      break;
    }
    case 1: {
      b.region("body", "body", blob(b.rng, 200, 270, 150, 14, 0.1), { smooth: true });
      const placed: [number, number, number][] = [];
      for (let tries = 0; placed.length < 5 + Math.round(b.complexity * 4) && tries < 200; tries++) {
        const r = b.rng.range(14, 36);
        const x = b.rng.range(90, 310);
        const y = b.rng.range(160, 320);
        if (placed.every(([px, py, pr]) => Math.hypot(px - x, py - y) > pr + r + 6)) placed.push([x, y, r]);
      }
      placed.forEach(([x, y, r], i) => b.region("eye", `eye ${i + 1}`, circle(x, y, r), { focal: true }));
      b.region("iris", "pupils", placed.map(([x, y, r]) => circle(x, y, r * 0.4, 16)));
      b.line(arc(200, 350, 50, 24, 0.2, PI - 0.2, 12), { smooth: true, w: 2.2 });
      [120, 170, 230, 280].forEach((x, i) => b.region("limb", `leg ${i + 1}`, capsule([x, 390], [x + (i < 2 ? -10 : 10), 470], 12, 10), { smooth: true }));
      break;
    }
    case 2:
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * PI * 2;
        const line = curve([[200, 250], [200 + Math.cos(a) * 110, 250 + Math.sin(a) * 110], [200 + Math.cos(a + 0.6) * 190, 250 + Math.sin(a + 0.6) * 190]], 18);
        b.region("tentacle", `tentacle ${i + 1}`, ribbon(line, 34, 4), { smooth: true });
      }
      b.region("core", "maw", circle(200, 250, 52), { focal: true });
      b.detail(circle(200, 250, 30, 24), { closed: true });
      break;
    case 3: {
      const cloud = Array.from({ length: 80 }, (_, i) => {
        const a = (i / 80) * PI * 2;
        const r = 110 + Math.abs(Math.sin(a * 4)) * 26;
        return [200 + Math.cos(a) * r * 1.3, 230 + Math.sin(a) * r * 0.8] as Pt;
      });
      [110, 170, 230, 290].forEach((x, i) => b.region("limb", `leg ${i + 1}`, capsule([x, 300], [x, 420], 12, 10), { smooth: true }));
      b.region("cloud", "cloud body", cloud, { smooth: true });
      b.region("eye", "eyes", [circle(170, 220, 8), circle(230, 220, 8)], { focal: true });
      b.line(arc(200, 245, 18, 10, 0.3, PI - 0.3, 8), { smooth: true });
      break;
    }
    default: {
      const heads = 3 + Math.round(b.complexity * 2);
      for (let i = 0; i < heads; i++) {
        const x = 90 + (i * 220) / (heads - 1);
        const neck = curve([[200, 380], [x + (x < 200 ? -30 : 30), 280], [x, 150]], 18);
        b.region("neck", `neck ${i + 1}`, ribbon(neck, 36, 20), { smooth: true });
        b.region("head", `head ${i + 1}`, ellipse(x, 136, 30, 22, 24, (x - 200) / 400), { smooth: true });
        b.region("eye", `eye ${i + 1}`, circle(x + 8, 130, 5), { focal: true });
        b.detail([[x - 10, 118], [x - 18, 96]]);
      }
      b.region("body", "body", blob(b.rng, 200, 410, 100, 10, 0.1), { smooth: true });
    }
  }
}

export function monsters(b: ArtBuilder, variant: number): void {
  const teethRow = (x0: number, x1: number, y: number, dir: 1 | -1, count: number, size: number): Poly[] =>
    Array.from({ length: count }, (_, i) => {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / count;
      const w = (x1 - x0) / count / 2;
      return [[x - w, y], [x + w, y], [x, y + dir * size]] as Poly;
    });
  switch (variant) {
    case 0:
      b.region("horn", "horns", [petal(120, 140, 70, 16, -2.2), petal(280, 140, 70, 16, -0.94)], { smooth: true });
      b.region("skin", "head", blob(b.rng, 200, 250, 160, 12, 0.08), { smooth: true });
      b.region("mouth", "grin", [...arc(200, 290, 130, 30, PI, PI * 2, 20), ...arc(200, 290, 130, 110, 0, PI, 20)], { smooth: true });
      b.region("teeth", "teeth", [...teethRow(80, 320, 290, 1, 9, 30), ...teethRow(110, 290, 390, -1, 7, 26)], { focal: true });
      b.region("eye", "eyes", [almond2(140, 180, 22, 10, 0.3), almond2(260, 180, 22, 10, -0.3)], { smooth: true, focal: true });
      break;
    case 1:
      b.region("horn", "left horn", ribbon(curve([[150, 170], [60, 150], [40, 60], [100, 30]], 20), 44, 4), { smooth: true });
      b.region("horn", "right horn", ribbon(curve([[250, 170], [340, 150], [360, 60], [300, 30]], 20), 44, 4), { smooth: true });
      b.region("skin", "head", ellipse(200, 280, 110, 150, 40), { smooth: true });
      b.region("eye", "eyes", [almond2(160, 240, 26, 7, 0.2), almond2(240, 240, 26, 7, -0.2)], { smooth: true, focal: true });
      b.region("nose", "nostrils", [ellipse(185, 320, 7, 11, 12), ellipse(215, 320, 7, 11, 12)], { smooth: true });
      b.line(arc(200, 370, 50, 20, 0.2, PI - 0.2, 12), { smooth: true, w: 2.2 });
      break;
    case 2:
      b.region("slime", "body", [...arc(200, 330, 170, 180, PI, PI * 2, 30), ...wave(370, 30, 330, 12, 4, 0, 30)], { smooth: true });
      b.region("drip", "drips", [0, 1, 2, 3, 4].map((i) => petal(70 + i * 65, 330, 60 + (i % 2) * 40, 14, PI / 2)), { smooth: true });
      b.region("crown", "crown", [[120, 170], [120, 90], [155, 130], [200, 70], [245, 130], [280, 90], [280, 170]], { focal: true });
      b.region("eye", "eyes", [circle(160, 240, 18), circle(240, 240, 18)], { focal: true });
      break;
    case 3:
      b.region("skin", "head", ellipse(200, 260, 150, 170, 48), { smooth: true });
      b.region("brow", "brow", ribbon(arc(200, 190, 110, 30, PI * 1.1, PI * 1.9, 14), 22, 22), { smooth: true });
      b.region("eye", "great eye", almond2(200, 240, 80, 40, 0), { smooth: true });
      b.region("iris", "iris", circle(200, 240, 32), { focal: true });
      b.region("pupil", "pupil", circle(200, 240, 12));
      b.region("mouth", "mouth", ellipse(200, 350, 70, 20, 30), { smooth: true });
      b.region("teeth", "tusks", [[[150, 345], [165, 345], [150, 300]], [[250, 345], [235, 345], [250, 300]]]);
      break;
    default:
      b.region("slime", "blob", blob(b.rng, 200, 270, 170, 11, 0.12), { smooth: true });
      b.region("mouth", "maw", circle(200, 300, 90, 48));
      b.region("tongue", "tongue", ellipse(200, 350, 44, 26, 24), { smooth: true });
      b.region("teeth", "teeth", Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * PI * 2;
        const [x, y] = [200 + Math.cos(a) * 90, 300 + Math.sin(a) * 90];
        return transform([[-9, 0], [9, 0], [0, 26]], { tx: x, ty: y, rot: a + PI / 2 });
      }), { focal: true });
      b.region("eye", "eyes", [circle(150, 150, 14), circle(250, 150, 14)], { focal: true });
  }
}

function almond2(cx: number, cy: number, w: number, h: number, tilt: number): Poly {
  return transform(
    [...arc(0, h * 0.4, w, h * 1.4, PI, PI * 2, 12), ...arc(0, -h * 0.4, w, h * 1.4, 0, PI, 12)],
    { tx: cx, ty: cy, rot: tilt },
  );
}
