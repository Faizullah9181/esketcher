import {
  arc,
  capsule,
  circle,
  clipToBox,
  ellipse,
  mirrorX,
  petal,
  rect,
  ribbon,
  star,
  transform,
  wave,
  type Poly,
  type Pt,
} from "@/lib/geometry";

import type { ArtBuilder } from "../builder";

const PI = Math.PI;

function almond(cx: number, cy: number, w: number, h: number, lower = 0.8, n = 16): Poly {
  const top: Poly = [];
  const bottom: Poly = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = cx - w + 2 * w * t;
    top.push([x, cy - h * Math.sin(PI * t)]);
    bottom.push([x, cy + h * lower * Math.sin(PI * t)]);
  }
  return [...top, ...bottom.reverse().slice(1, -1)];
}

function drawEye(b: ArtBuilder, cx: number, cy: number, w: number, side: string, closed = false): void {
  if (closed) {
    b.line(arc(cx, cy - w * 0.1, w, w * 0.35, 0.1, PI - 0.1, 14), { smooth: true });
    for (let i = 1; i < 5; i++) {
      const a = 0.2 + (i / 5) * (PI - 0.4);
      const x = cx + Math.cos(a) * w;
      const y = cy - w * 0.1 + Math.sin(a) * w * 0.35;
      b.detail([
        [x, y],
        [x + Math.cos(a) * 6, y + 7],
      ]);
    }
    return;
  }
  b.region("eye", `${side} eye`, almond(cx, cy, w, w * 0.45), { smooth: true, focal: true });
  b.region("iris", `${side} iris`, circle(cx, cy, w * 0.36), { focal: true });
  b.detail(circle(cx, cy, w * 0.15, 16), { closed: true, o: 0.9, w: 1.2 });
}

function drawFace(b: ArtBuilder, cx: number, cy: number, s: number, opts: { closed?: boolean; side?: string } = {}) {
  const prefix = opts.side ? `${opts.side} ` : "";
  b.region("skin", `${prefix}neck`, [
    [cx - 24 * s, cy + 80 * s],
    [cx + 24 * s, cy + 80 * s],
    [cx + 34 * s, cy + 150 * s],
    [cx - 34 * s, cy + 150 * s],
  ]);
  b.region("face", `${prefix}face`, ellipse(cx, cy, 76 * s, 98 * s, 56), { smooth: true });
  const hairOuter = arc(cx, cy - 6 * s, 92 * s, 112 * s, PI * 1.02, PI * 1.98, 22).map(
    ([x, y], i) => [x, y + (i % 2 ? 6 * s : 0)] as Pt,
  );
  const hairInner = arc(cx, cy - 18 * s, 74 * s, 70 * s, PI * 1.94, PI * 1.06, 18);
  b.region("hair", `${prefix}hair`, [...hairOuter, ...hairInner], { smooth: true });
  for (const [dir, name] of [
    [-1, "left"],
    [1, "right"],
  ] as const) {
    const ex = cx + dir * 30 * s;
    drawEye(b, ex, cy - 6 * s, 19 * s, `${prefix}${name}`, opts.closed);
    b.line(arc(ex, cy - 20 * s, 20 * s, 9 * s, PI * 1.15, PI * 1.85, 10), { smooth: true, w: 2.2 });
  }
  b.line(
    [
      [cx + 2 * s, cy - 2 * s],
      [cx - 7 * s, cy + 26 * s],
      [cx + 5 * s, cy + 31 * s],
    ],
    { smooth: true },
  );
  b.region("mouth", `${prefix}mouth`, almond(cx, cy + 54 * s, 20 * s, 7 * s, 1.1, 10), { smooth: true });
  b.detail(wave(cx - 19 * s, cx + 19 * s, cy + 54 * s, 1.5 * s, 1, 0, 10), { smooth: true });
  if (b.detailed(0.6)) {
    b.shade(ellipse(cx - 46 * s, cy + 26 * s, 14 * s, 9 * s, 12), -0.5, 0);
    b.shade(ellipse(cx + 46 * s, cy + 26 * s, 14 * s, 9 * s, 12), -0.5, 0);
  }
}

export function faces(b: ArtBuilder, variant: number): void {
  switch (variant) {
    case 0:
      drawFace(b, 200, 225, 1.4);
      break;
    case 1: {
      b.region("hair", "hair", ellipse(170, 175, 108, 96, 40, -0.3), { smooth: true });
      const profile: Poly = [
        [150, 100], [230, 110], [258, 170], [262, 212], [288, 250], [262, 262],
        [270, 282], [258, 292], [264, 312], [246, 342], [205, 352], [185, 400],
        [120, 400], [128, 330], [100, 250], [110, 160],
      ];
      b.region("face", "profile", profile, { smooth: true });
      b.region("skin", "ear", ellipse(160, 245, 16, 26, 20), { smooth: true });
      b.region("eye", "eye", almond(232, 212, 13, 6), { smooth: true, focal: true });
      b.region("mouth", "lips", almond(262, 290, 8, 5, 1, 8), { smooth: true });
      b.line(arc(230, 196, 18, 7, PI * 1.1, PI * 1.9, 8), { smooth: true, w: 2.2 });
      b.region("fabric", "collar", [[110, 400], [200, 395], [260, 470], [80, 470]], { smooth: true });
      break;
    }
    case 2: {
      const head = ellipse(200, 235, 110, 140, 64);
      const thirds = [0, 1, 2].map((i) => clipToBox(head, { x: 90 + i * 73.4, y: 0, w: 73.4, h: 500 }));
      ["left third", "middle third", "right third"].forEach((label, i) => b.region("face", label, thirds[i]));
      for (const [dir, name] of [[-1, "left"], [1, "right"]] as const) drawEye(b, 200 + dir * 44, 215, 24, name);
      b.region("mouth", "mouth", rect(170, 300, 60, 12));
      b.region("skin", "neck", rect(170, 372, 60, 90));
      break;
    }
    case 3: {
      drawFace(b, 180, 270, 1.2, { closed: true });
      [
        [300, 110, 34],
        [262, 160, 18],
        [238, 190, 9],
      ].forEach(([x, y, r], i) => b.region("bubble", `dream ${i + 1}`, circle(x, y, r), { focal: i === 0 }));
      b.detail(star(300, 110, 16, 6, 5), { closed: true });
      break;
    }
    default:
      drawFace(b, 132, 250, 0.82, { side: "first" });
      drawFace(b, 268, 250, 0.82, { side: "second" });
  }
}

const FINGERS: { angles: number[]; lengths: number[]; thumb: [number, number] }[] = [
  { angles: [-18, -6, 5, 17], lengths: [80, 100, 96, 76], thumb: [-72, 70] },
  { angles: [-4, 30, 38, 44], lengths: [116, 34, 32, 30], thumb: [-40, 48] },
  { angles: [-44, -4, 6, 16], lengths: [62, 98, 92, 74], thumb: [-38, 76] },
  { angles: [12, 18, 24, 30], lengths: [96, 116, 110, 90], thumb: [-30, 80] },
  { angles: [-14, 4, 36, 44], lengths: [96, 104, 34, 30], thumb: [-60, 44] },
];

export function hands(b: ArtBuilder, variant: number): void {
  const pose = FINGERS[variant % FINGERS.length];
  b.region("fabric", "sleeve", [[150, 400], [250, 400], [270, 500], [130, 500]]);
  b.detail([[150, 418], [250, 418]]);
  const palm: Poly = [[138, 262], [262, 262], [270, 344], [246, 404], [154, 404], [130, 344]];
  b.region("skin", "palm", palm, { smooth: true });
  const bases: Pt[] = [[152, 272], [185, 262], [217, 262], [248, 272]];
  const names = ["index", "middle", "ring", "little"];
  bases.forEach((base, i) => {
    const a = ((pose.angles[i] - 90) * PI) / 180;
    const tip: Pt = [base[0] + Math.cos(a) * pose.lengths[i], base[1] + Math.sin(a) * pose.lengths[i]];
    b.region("finger", `${names[i]} finger`, capsule(base, tip, 15, 12), { smooth: true });
    if (pose.lengths[i] > 60) {
      const nail: Pt = [base[0] + Math.cos(a) * (pose.lengths[i] - 6), base[1] + Math.sin(a) * (pose.lengths[i] - 6)];
      b.region("nail", `${names[i]} nail`, ellipse(nail[0], nail[1], 6, 8, 12, a + PI / 2));
      const knuckle: Pt = [base[0] + Math.cos(a) * pose.lengths[i] * 0.5, base[1] + Math.sin(a) * pose.lengths[i] * 0.5];
      b.detail(arc(knuckle[0], knuckle[1], 9, 3, a + PI * 0.6, a + PI * 1.4, 6), { smooth: true });
    }
  });
  const ta = ((pose.thumb[0] - 90) * PI) / 180;
  const thumbBase: Pt = [140, 350];
  b.region("finger", "thumb", capsule(thumbBase, [thumbBase[0] + Math.cos(ta) * pose.thumb[1], thumbBase[1] + Math.sin(ta) * pose.thumb[1]], 18, 13), { smooth: true });
  b.detail(arc(200, 330, 46, 30, PI * 0.15, PI * 0.85, 12), { smooth: true });
  if (variant === 2) b.region("core", "mudra ring", circle(132, 214, 14), { focal: true });
  b.shade(palm, -0.8, 0.55);
}

export function eyes(b: ArtBuilder, variant: number): void {
  const cx = 200;
  const cy = 250;
  const lashes = (w: number, h: number, count: number) => {
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const x = cx - w + 2 * w * t;
      const y = cy - h * Math.sin(PI * t);
      const a = -PI / 2 + (t - 0.5) * 1.6;
      b.line([[x, y], [x + Math.cos(a) * 18, y + Math.sin(a) * 18]], { w: 1.2 });
    }
  };
  switch (variant) {
    case 0:
      b.region("brow", "brow", ribbon(arc(cx, 190, 150, 40, PI * 1.1, PI * 1.9, 16), 14, 6), { smooth: true });
      b.region("eye", "sclera", almond(cx, cy, 160, 76), { smooth: true });
      b.region("iris", "iris", circle(cx, cy, 58), { focal: true });
      b.region("pupil", "pupil", circle(cx, cy, 24));
      b.detail(circle(cx - 18, cy - 20, 9, 14), { closed: true, o: 1 });
      if (b.detailed(0.4)) for (let i = 0; i < 24; i++) {
        const a = (i / 24) * PI * 2;
        b.detail([[cx + Math.cos(a) * 28, cy + Math.sin(a) * 28], [cx + Math.cos(a) * 54, cy + Math.sin(a) * 54]], { o: 0.4 });
      }
      lashes(160, 76, 13);
      b.line(arc(cx, cy + 4, 150, 90, 0.2, PI - 0.2, 20), { smooth: true, o: 0.6 });
      break;
    case 1: {
      b.region("eye", "housing", almond(cx, cy, 170, 90), { smooth: true });
      b.region("rim", "iris rim", circle(cx, cy, 86));
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * PI * 2;
        const pts = [...arc(cx, cy, 78, 78, a0, a0 + PI / 4 - 0.06, 6), ...arc(cx, cy, 30, 30, a0 + PI / 4 - 0.06, a0, 4)];
        b.region("iris", `iris blade ${i + 1}`, pts, { focal: i % 2 === 0 });
      }
      b.region("pupil", "aperture", ellipse(cx, cy, 24, 24, 6, PI / 6));
      for (let i = 0; i < 6; i++) b.detail(circle(cx + Math.cos((i / 6) * PI * 2) * 100, cy + Math.sin((i / 6) * PI * 2) * 60, 4, 8), { closed: true });
      break;
    }
    case 2: {
      b.region("halo", "halo", circle(cx, cy, 150, 64));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * PI * 2;
        b.region("ray", `ray ${i + 1}`, petal(cx + Math.cos(a) * 118, cy + Math.sin(a) * 118, 70, 10, a));
      }
      b.region("eye", "third eye", transform(almond(0, 0, 96, 50), { tx: cx, ty: cy, rot: PI / 2 }), { smooth: true });
      b.region("iris", "iris", circle(cx, cy, 36), { focal: true });
      b.region("pupil", "pupil", circle(cx, cy, 14));
      break;
    }
    case 3: {
      const lid: Poly = almond(cx, cy, 170, 90, 0.75).map(([x, y]) => [x, y + (x - cx) * -0.12] as Pt);
      b.region("eye", "cat eye", lid, { smooth: true });
      b.region("iris", "iris", ellipse(cx, cy, 78, 72), { focal: true });
      b.region("pupil", "slit pupil", [...arc(cx + 40, cy, 44, 62, PI * 0.72, PI * 1.28, 12), ...arc(cx - 40, cy, 44, 62, PI * 1.72, PI * 2.28, 12)], { smooth: true });
      lashes(170, 90, 9);
      break;
    }
    default:
      b.region("eye", "eye", almond(cx, 200, 150, 66), { smooth: true });
      b.region("iris", "iris", circle(cx, 205, 50), { focal: true });
      b.region("pupil", "pupil", circle(cx, 205, 20));
      lashes(150, 66, 11);
      b.line(arc(cx, 210, 146, 60, 0.15, PI - 0.15, 20), { smooth: true });
      b.region("water", "tear", petal(262, 380, 90, 30, -PI / 2), { smooth: true, focal: true });
      b.detail(arc(254, 400, 10, 14, PI * 0.9, PI * 1.5, 6), { smooth: true, o: 0.9 });
  }
}

type Pose = Record<"head" | "sl" | "sr" | "el" | "er" | "hl" | "hr" | "pl" | "pr" | "kl" | "kr" | "fl" | "fr", Pt>;

const POSES: Pose[] = [
  { head: [210, 80], sl: [180, 130], sr: [240, 130], el: [140, 80], er: [280, 70], hl: [120, 30], hr: [300, 20], pl: [190, 240], pr: [230, 240], kl: [150, 320], kr: [290, 300], fl: [180, 440], fr: [340, 260] },
  { head: [200, 120], sl: [168, 170], sr: [232, 170], el: [150, 250], er: [262, 240], hl: [190, 300], hr: [240, 300], pl: [180, 290], pr: [228, 290], kl: [120, 320], kr: [290, 322], fl: [120, 440], fr: [296, 440] },
  { head: [250, 90], sl: [220, 140], sr: [270, 150], el: [190, 210], er: [320, 190], hl: [230, 250], hr: [330, 120], pl: [210, 260], pr: [240, 262], kl: [130, 320], kr: [300, 320], fl: [80, 280], fr: [290, 440] },
  { head: [200, 70], sl: [110, 160], sr: [290, 160], el: [80, 300], er: [320, 300], hl: [90, 430], hr: [310, 430], pl: [140, 400], pr: [260, 400], kl: [150, 500], kr: [250, 500], fl: [150, 520], fr: [250, 520] },
  { head: [70, 230], sl: [110, 250], sr: [120, 290], el: [80, 330], er: [180, 320], hl: [60, 380], hr: [230, 340], pl: [240, 280], pr: [250, 310], kl: [310, 250], kr: [320, 300], fl: [370, 300], fr: [380, 330] },
];

export function bodies(b: ArtBuilder, variant: number): void {
  const p = POSES[variant % POSES.length];
  if (variant === 1) b.region("block", "seat", rect(120, 300, 170, 150));
  if (variant === 4) b.region("fabric", "couch", [[20, 340], [390, 340], [390, 420], [20, 420]], { smooth: false });
  const thick = variant === 3 ? 1.9 : 1;
  const limb = (a: Pt, c: Pt, r0: number, r1: number, label: string) =>
    b.region("limb", label, capsule(a, c, r0 * thick, r1 * thick), { smooth: true });
  limb(p.pl, p.kl, 17, 14, "left thigh");
  limb(p.kl, p.fl, 14, 9, "left shin");
  limb(p.pr, p.kr, 17, 14, "right thigh");
  limb(p.kr, p.fr, 14, 9, "right shin");
  b.region("body", "torso", [p.sl, p.sr, [(p.sr[0] + p.pr[0]) / 2 + 8, (p.sr[1] + p.pr[1]) / 2], p.pr, p.pl, [(p.sl[0] + p.pl[0]) / 2 - 8, (p.sl[1] + p.pl[1]) / 2]], { smooth: true });
  limb(p.sl, p.el, 13, 11, "left upper arm");
  limb(p.el, p.hl, 11, 7, "left forearm");
  limb(p.sr, p.er, 13, 11, "right upper arm");
  limb(p.er, p.hr, 11, 7, "right forearm");
  b.region("face", "head", ellipse(p.head[0], p.head[1], 26 * thick, 32 * thick, 32), { smooth: true, focal: true });
  if (variant === 3) {
    b.detail(arc(170, 210, 40, 22, 0.2, PI - 0.2, 12), { smooth: true });
    b.detail(arc(230, 210, 40, 22, 0.2, PI - 0.2, 12), { smooth: true });
    b.detail([[200, 170], [200, 380]], { o: 0.4 });
  }
  if (b.detailed(0.5)) b.detail(wave(20, 380, 470, 3, 3, 0, 30), { smooth: true, o: 0.4 });
}

export function masks(b: ArtBuilder, variant: number): void {
  const cx = 200;
  switch (variant) {
    case 0: {
      for (let i = 0; i < 5; i++) b.region("feather", `feather ${i + 1}`, petal(150 - i * 10, 180, 160 - i * 12, 20, -PI / 2 - 0.25 - i * 0.18), { smooth: true });
      const half: Poly = [[200, 222], [150, 200], [80, 190], [40, 230], [70, 280], [130, 300], [185, 290], [200, 262]];
      b.region("mask", "mask", [...half, ...mirrorX(half, cx)], { smooth: true });
      b.region("eye", "left eye hole", almond(140, 245, 34, 16), { smooth: true, focal: true });
      b.region("eye", "right eye hole", almond(260, 245, 34, 16), { smooth: true, focal: true });
      b.line(wave(60, 30, 300, 8, 1.5, 0, 12).map(([x, y], i) => [x - i * 2, y + i * 12] as Pt), { smooth: true });
      b.line(wave(340, 370, 300, 8, 1.5, 0, 12).map(([x, y], i) => [x + i * 2, y + i * 12] as Pt), { smooth: true });
      for (let i = 0; i < 7; i++) b.detail(circle(90 + i * 37, 312 - Math.sin((i / 6) * PI) * 12, 3, 8), { closed: true });
      break;
    }
    case 1: {
      b.region("horn", "left horn", ribbon([[150, 150], [120, 100], [110, 50], [130, 20]], 34, 4), { smooth: true });
      b.region("horn", "right horn", ribbon([[250, 150], [280, 100], [290, 50], [270, 20]], 34, 4), { smooth: true });
      const jaw: Poly = [[200, 110], [290, 140], [320, 240], [300, 350], [240, 420], [160, 420], [100, 350], [80, 240], [110, 140]];
      b.region("face", "face", jaw, { smooth: true });
      b.region("brow", "brows", [[110, 200], [185, 225], [175, 245], [120, 230]], { smooth: false });
      b.region("brow", "brows", [[290, 200], [215, 225], [225, 245], [280, 230]], { smooth: false });
      b.region("eye", "left eye", almond(150, 262, 26, 12), { smooth: true, focal: true });
      b.region("eye", "right eye", almond(250, 262, 26, 12), { smooth: true, focal: true });
      b.region("mouth", "mouth", almond(cx, 355, 70, 26, 1), { smooth: true });
      b.region("teeth", "fangs", [[[150, 340], [165, 340], [158, 380]], [[250, 340], [235, 340], [242, 380]]]);
      break;
    }
    case 2: {
      const shield: Poly = [[200, 40], [320, 130], [300, 380], [200, 470], [100, 380], [80, 130]];
      b.region("mask", "shield", shield);
      const bands = [0, 1, 2, 3].map((i) => clipToBox(shield, { x: 0, y: 300 + i * 40, w: 400, h: 20 }));
      b.region("band", "lower bands", bands);
      b.region("ridge", "nose ridge", [[190, 110], [210, 110], [220, 290], [180, 290]]);
      b.region("eye", "left eye", [[120, 200], [180, 190], [170, 225]], { focal: true });
      b.region("eye", "right eye", [[280, 200], [220, 190], [230, 225]], { focal: true });
      b.region("mouth", "mouth", rect(165, 320, 70, 18));
      break;
    }
    case 3: {
      b.region("fabric", "hood", [[120, 150], [200, 110], [280, 150], [300, 300], [340, 480], [60, 480], [100, 300]], { smooth: true });
      b.region("hat", "brim", ellipse(200, 130, 150, 28, 40), { smooth: true });
      b.region("hat", "crown", [[140, 128], [150, 40], [250, 40], [260, 128]]);
      b.region("mask", "face plate", ellipse(200, 230, 70, 80, 36), { smooth: true });
      b.region("beak", "beak", petal(222, 260, 180, 36, 0.7), { smooth: true });
      b.region("eye", "left goggle", circle(170, 220, 22), { focal: true });
      b.region("eye", "right goggle", circle(232, 214, 22), { focal: true });
      break;
    }
    default:
      b.region("face", "ghost face", [...ellipse(200, 230, 110, 170, 48).slice(0, 25), ...wave(90, 310, 390, 14, 3, PI, 18).reverse()].map(([x, y]) => [x, y] as Pt), { smooth: true });
      b.region("eye", "left eye", ellipse(158, 190, 20, 40, 24, -0.15), { smooth: true, focal: true });
      b.region("eye", "right eye", ellipse(242, 190, 20, 40, 24, 0.15), { smooth: true, focal: true });
      b.region("mouth", "mouth", ellipse(200, 300, 26, 40, 24), { smooth: true });
  }
}

export function fashion(b: ArtBuilder, variant: number): void {
  const cx = 200;
  b.region("skin", "neck", rect(188, 78, 24, 34));
  b.region("face", "mannequin head", ellipse(cx, 58, 26, 32, 28), { smooth: true });
  switch (variant) {
    case 0: {
      const skirt: Poly = [[165, 210], [235, 210], ...wave(330, 70, 470, 10, 3, 0, 24).map(([x, y]) => [x, y] as Pt)];
      b.region("fabric", "skirt", skirt, { smooth: true });
      b.region("fabric", "bodice", [[160, 110], [240, 110], [236, 210], [164, 210]], { smooth: true });
      b.region("sash", "sash", [[160, 200], [240, 200], [242, 222], [158, 222]]);
      for (let i = 0; i < 6; i++) b.detail(curvePts(180 + i * 8, 222, 100 + i * 45, 460), { smooth: true });
      break;
    }
    case 1: {
      b.region("fabric", "left sleeve", capsule([150, 125], [110, 330], 22, 18), { smooth: true });
      b.region("fabric", "right sleeve", capsule([250, 125], [290, 330], 22, 18), { smooth: true });
      b.region("coat", "coat", [[140, 110], [260, 110], [275, 300], [290, 440], [110, 440], [125, 300]]);
      b.region("collar", "collar", [[[160, 110], [200, 180], [180, 110]], [[240, 110], [200, 180], [220, 110]]]);
      b.region("belt", "belt", [[128, 260], [272, 260], [274, 282], [126, 282]]);
      b.region("button", "buttons", [0, 1, 2, 3].map((i) => circle(215, 200 + i * 55, 6, 12)), { focal: true });
      break;
    }
    case 2: {
      b.region("fabric", "bodice", [[172, 110], [228, 110], [224, 200], [176, 200]], { smooth: true });
      for (let i = 2; i >= 0; i--) {
        const top = 200 + i * 70;
        b.region("tier", `tier ${3 - i}`, [[176 - i * 30, top], [224 + i * 30, top], ...wave(330 - i * 20 + 40, 70 + i * 20 - 40, top + 110, 8, 4, i, 24)], { smooth: true });
      }
      b.region("bow", "bow", [[[200, 200], [160, 180], [160, 220]], [[200, 200], [240, 180], [240, 220]]]);
      break;
    }
    case 3: {
      b.region("fabric", "left leg", [[160, 300], [198, 300], [192, 480], [162, 480]]);
      b.region("fabric", "right leg", [[202, 300], [240, 300], [238, 480], [208, 480]]);
      b.region("fabric", "left sleeve", capsule([150, 125], [128, 300], 20, 16), { smooth: true });
      b.region("fabric", "right sleeve", capsule([250, 125], [272, 300], 20, 16), { smooth: true });
      b.region("coat", "jacket", [[145, 110], [255, 110], [262, 320], [138, 320]]);
      b.region("collar", "lapels", [[[168, 110], [200, 210], [150, 160]], [[232, 110], [200, 210], [250, 160]]]);
      b.region("pocket", "pockets", [rect(150, 260, 32, 10), rect(218, 260, 32, 10)]);
      break;
    }
    default:
      b.region("fabric", "left sleeve", [[150, 120], [40, 150], [50, 300], [150, 270]]);
      b.region("fabric", "right sleeve", [[250, 120], [360, 150], [350, 300], [250, 270]]);
      b.region("fabric", "robe", [[140, 110], [260, 110], [270, 470], [130, 470]]);
      b.region("belt", "obi", rect(135, 230, 130, 50));
      b.region("collar", "collar", [[170, 110], [200, 230], [230, 110], [215, 110], [200, 190], [185, 110]]);
      for (let i = 0; i < 6; i++) b.detail(circle(160 + (i % 3) * 40, 320 + Math.floor(i / 3) * 70, 10, 14), { closed: true });
  }
}

function curvePts(x0: number, y0: number, x1: number, y1: number): Poly {
  return [[x0, y0], [(x0 * 2 + x1) / 3, (y0 + y1) / 2], [x1, y1]];
}
