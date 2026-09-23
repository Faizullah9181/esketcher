import { memo, type CSSProperties, type ReactNode } from "react";

import type { Box, Pt } from "@/lib/geometry";
import { hashString } from "@/lib/rng";
import type { Region } from "@/lib/sketchArt";
import type { Material } from "@/types";

import {
  blobs,
  brushStrokes,
  facets,
  inkBranches,
  particles,
  pixelCells,
  reachFrom,
  revealDuration,
  spectrum,
  wobble,
} from "./recipes";

export interface PaintLayerProps {
  /** unique per board + region + application, used to scope SVG ids */
  uid: string;
  material: Material;
  region: Pick<Region, "d" | "box">;
  origin: Pt;
  animate: boolean;
  /** ambient motion (chrome sweep, glitter twinkle); stronger in chaos mode */
  ambient: "calm" | "alive";
  exiting?: boolean;
}

const EASE = {
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  back: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  slow: "cubic-bezier(0.45, 0, 0.2, 1)",
};

type Anim = (name: string, delayFraction?: number, extra?: CSSProperties, ease?: keyof typeof EASE) => CSSProperties | undefined;

function makeAnim(animate: boolean, duration: number): Anim {
  return (name, delayFraction = 0, extra = {}, ease = "out") =>
    animate
      ? { animation: `${name} ${duration}ms ${EASE[ease]} ${Math.round(delayFraction * duration)}ms both`, ...extra }
      : undefined;
}

const pad = (box: Box, n = 6): Box => ({ x: box.x - n, y: box.y - n, w: box.w + n * 2, h: box.h + n * 2 });
const rectProps = (b: Box) => ({ x: b.x, y: b.y, width: b.w, height: b.h });
const fillBox: CSSProperties = { transformBox: "fill-box", transformOrigin: "center" };

function Surface({ uid, material, box, origin, animate, ambient }: { uid: string; material: Material; box: Box; origin: Pt; animate: boolean; ambient: "calm" | "alive" }): ReactNode {
  const [base, hi, lo] = material.palette;
  const color = [base, hi, lo];
  const seed = hashString(uid);
  const duration = revealDuration(material);
  const anim = makeAnim(animate, duration);
  const reach = reachFrom(origin, box);
  const area = box.w * box.h;
  const alive = ambient === "alive";

  switch (material.type) {
    case "liquid":
      return (
        <>
          <defs>
            <radialGradient id={`${uid}-g`} gradientUnits="userSpaceOnUse" cx={origin[0]} cy={origin[1]} r={reach}>
              <stop offset="0" stopColor={hi} />
              <stop offset="0.38" stopColor={base} />
              <stop offset="1" stopColor={lo} />
            </radialGradient>
            {animate && (
              <mask id={`${uid}-m`} maskUnits="userSpaceOnUse" {...rectProps(pad(box, 40))}>
                <path d={wobble(origin, reach, seed)} fill="#fff" style={{ ...fillBox, ...anim("es-grow") }} />
              </mask>
            )}
          </defs>
          <g mask={animate ? `url(#${uid}-m)` : undefined}>
            <rect {...rectProps(box)} fill={`url(#${uid}-g)`} />
            <path d={wobble(origin, reach * 0.55, seed + 1)} fill="none" stroke={hi} strokeOpacity={0.28} strokeWidth={2} />
            <path d={wobble(origin, reach * 0.8, seed + 2)} fill="none" stroke={hi} strokeOpacity={0.16} strokeWidth={1.5} />
            <ellipse cx={box.x + box.w * 0.32} cy={box.y + box.h * 0.26} rx={box.w * 0.22} ry={box.h * 0.1} fill="#fff" opacity={0.14} />
          </g>
        </>
      );

    case "chrome":
    case "holographic": {
      const stops =
        material.type === "chrome" ? [lo, base, hi, base, lo, base, hi, lo] : spectrum(material.palette);
      return (
        <>
          <defs>
            <linearGradient id={`${uid}-g`} gradientUnits="userSpaceOnUse" x1={box.x} y1={box.y} x2={box.x + box.w * 0.6} y2={box.y + box.h} spreadMethod="reflect">
              {stops.map((c, i) => (
                <stop key={i} offset={i / (stops.length - 1)} stopColor={c} />
              ))}
            </linearGradient>
            {material.type === "holographic" && (
              <pattern id={`${uid}-p`} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(35)">
                <line x1={0} y1={0} x2={0} y2={6} stroke="#fff" strokeOpacity={0.22} strokeWidth={1.2} />
              </pattern>
            )}
            {animate && (
              <mask id={`${uid}-m`} maskUnits="userSpaceOnUse" {...rectProps(pad(box, 40))}>
                <rect {...rectProps(pad(box, 20))} fill="#fff" style={anim("es-wipe", 0, { ["--from" as string]: `${-box.w * 1.3}px` } as CSSProperties)} />
              </mask>
            )}
          </defs>
          <g mask={animate ? `url(#${uid}-m)` : undefined}>
            <rect
              x={box.x - box.w}
              y={box.y}
              width={box.w * 3}
              height={box.h}
              fill={`url(#${uid}-g)`}
              className="es-shimmer"
              style={{ ["--shift" as string]: `${box.w * (alive ? 0.9 : 0.5)}px`, animationDuration: `${alive ? 3.2 : 7}s` } as CSSProperties}
            />
            {material.type === "holographic" && <rect {...rectProps(box)} fill={`url(#${uid}-p)`} style={{ mixBlendMode: "overlay" }} />}
            <rect {...rectProps(box)} fill="#fff" opacity={material.type === "chrome" ? 0.05 : 0.08} />
          </g>
        </>
      );
    }

    case "watercolor": {
      const blooms = blobs(box, seed, 5, 0.42);
      return (
        <>
          <rect {...rectProps(box)} fill={base} opacity={0.22} style={anim("es-fade", 0.1)} />
          {blooms.map((b, i) => (
            <path key={i} d={b.d} fill={color[b.color]} opacity={0.36} filter="url(#es-blur-md)" style={{ ...fillBox, ...anim("es-grow", b.delay, {}, "slow") }} />
          ))}
        </>
      );
    }

    case "ink": {
      const branches = inkBranches(box, origin, seed);
      const width = Math.hypot(box.w, box.h) * 0.2;
      return (
        <>
          <defs>
            <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={lo} />
              <stop offset="0.6" stopColor={base} />
              <stop offset="1" stopColor={hi} />
            </linearGradient>
            {animate && (
              <mask id={`${uid}-m`} maskUnits="userSpaceOnUse" {...rectProps(pad(box, 60))}>
                {branches.map((d, i) => (
                  <path key={i} d={d} stroke="#fff" strokeWidth={width} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray="1" style={anim("es-draw", i * 0.03)} />
                ))}
                <rect {...rectProps(pad(box, 20))} fill="#fff" style={anim("es-fade", 0.55)} />
              </mask>
            )}
          </defs>
          <g mask={animate ? `url(#${uid}-m)` : undefined}>
            <rect {...rectProps(box)} fill={`url(#${uid}-g)`} />
            {branches.map((d, i) => (
              <path key={i} d={d} stroke={lo} strokeWidth={2.5} strokeOpacity={0.55} fill="none" filter="url(#es-blur-sm)" />
            ))}
          </g>
        </>
      );
    }

    case "spray": {
      const dots = particles(box, origin, seed, Math.min(260, Math.round(60 + area / 160)), 1);
      return (
        <>
          <rect {...rectProps(box)} fill={base} opacity={0.5} mask="url(#es-tooth)" style={anim("es-fade", 0.35)} />
          {dots.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={color[p.color]} style={anim("es-fly", p.delay, { ["--dx" as string]: `${p.dx}px`, ["--dy" as string]: `${p.dy}px` } as CSSProperties)} />
          ))}
        </>
      );
    }

    case "glitter": {
      const sparks = particles(box, origin, seed, Math.min(170, Math.round(40 + area / 260)), 1);
      return (
        <>
          <defs>
            <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={lo} />
              <stop offset="1" stopColor={base} stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <rect {...rectProps(box)} fill={`url(#${uid}-g)`} style={anim("es-fade", 0.3)} />
          {sparks.map((p, i) => {
            const s = p.r * 1.6;
            return (
              <path
                key={i}
                d={`M${p.x} ${p.y - s}L${p.x + s * 0.3} ${p.y - s * 0.3}L${p.x + s} ${p.y}L${p.x + s * 0.3} ${p.y + s * 0.3}L${p.x} ${p.y + s}L${p.x - s * 0.3} ${p.y + s * 0.3}L${p.x - s} ${p.y}L${p.x - s * 0.3} ${p.y - s * 0.3}Z`}
                fill={p.color === 2 ? "#fff" : color[p.color]}
                className={i % 4 === 0 ? "es-twinkle" : undefined}
                style={{ ...fillBox, ...(animate ? anim("es-orbit", p.delay, { ["--dx" as string]: `${p.dx}px`, ["--dy" as string]: `${p.dy}px` } as CSSProperties, "back") : { animationDelay: `${(i % 7) * 0.4}s` }) }}
              />
            );
          })}
        </>
      );
    }

    case "smoke": {
      const puffs = blobs(box, seed, 6, 0.5);
      return (
        <g filter="url(#es-blur-lg)">
          {puffs.map((b, i) => (
            <path
              key={i}
              d={b.d}
              fill={color[b.color]}
              opacity={0.5}
              className={alive ? "es-drift" : undefined}
              style={{ ...fillBox, ["--dx" as string]: `${(i % 2 ? 1 : -1) * 14}px`, ["--dy" as string]: `${-10 - i * 2}px`, ...(anim("es-grow", b.delay, {}, "slow") ?? {}) } as CSSProperties}
            />
          ))}
        </g>
      );
    }

    case "lava": {
      const magma = blobs(box, seed, 5, 0.34);
      const cracks = inkBranches(box, [box.x + box.w / 2, box.y + box.h / 2], seed + 7, 6);
      return (
        <>
          {animate && (
            <defs>
              <mask id={`${uid}-m`} maskUnits="userSpaceOnUse" {...rectProps(pad(box, 40))}>
                <path
                  d={`M${box.x - 30} ${box.y - 20}Q${box.x + box.w * 0.25} ${box.y - 50} ${box.x + box.w * 0.5} ${box.y - 20}T${box.x + box.w + 30} ${box.y - 20}V${box.y + box.h + 30}H${box.x - 30}Z`}
                  fill="#fff"
                  style={anim("es-rise", 0, { ["--from" as string]: `${box.h + 60}px` } as CSSProperties, "slow")}
                />
              </mask>
            </defs>
          )}
          <g mask={animate ? `url(#${uid}-m)` : undefined}>
            <rect {...rectProps(box)} fill={lo} />
            <g filter="url(#es-blur-md)">
              {magma.map((b, i) => (
                <path key={i} d={b.d} fill={i % 2 ? hi : base} opacity={0.9} className={alive ? "es-drift" : undefined} style={{ ...fillBox, ["--dx" as string]: `${(i % 2 ? 1 : -1) * 10}px`, ["--dy" as string]: "8px" } as CSSProperties} />
              ))}
            </g>
            {cracks.map((d, i) => (
              <path key={i} d={d} stroke={lo} strokeWidth={3} strokeOpacity={0.7} fill="none" strokeLinejoin="round" />
            ))}
          </g>
        </>
      );
    }

    case "pixel": {
      const cells = pixelCells(box, origin, seed, material.roughness);
      return (
        <>
          <rect {...rectProps(box)} fill={lo} opacity={0.6} style={anim("es-fade", 0.4)} />
          {cells.map((c, i) => (
            <rect key={i} x={c.x} y={c.y} width={c.s} height={c.s} fill={color[c.color]} opacity={0.9} style={{ ...fillBox, ...anim("es-pop", c.delay, {}, "back") }} />
          ))}
        </>
      );
    }

    case "crystal": {
      const shards = facets(box, origin, seed);
      return (
        <>
          {shards.map((f, i) => (
            <polygon
              key={i}
              points={f.points.map((p) => p.join(",")).join(" ")}
              fill={color[f.color]}
              opacity={f.opacity}
              stroke="#fff"
              strokeOpacity={0.35}
              strokeWidth={0.8}
              style={{ ...fillBox, ...anim("es-pop", f.delay, {}, "back") }}
            />
          ))}
        </>
      );
    }

    case "impasto": {
      const strokes = brushStrokes(box, seed, material.roughness);
      return (
        <>
          <rect {...rectProps(box)} fill={lo} opacity={0.7} style={anim("es-fade", 0.2)} />
          {strokes.map((s, i) => (
            <g key={i}>
              <path d={s.d} transform="translate(2 3)" stroke="#000" strokeOpacity={0.35} strokeWidth={s.width} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray="1" style={anim("es-draw", s.delay)} />
              <path d={s.d} stroke={color[s.color]} strokeWidth={s.width} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray="1" style={anim("es-draw", s.delay)} />
              {/* bristle drag: thin lighter and darker lines riding the stroke */}
              <path d={s.d} transform={`translate(0 ${-s.width * 0.22})`} stroke={hi} strokeOpacity={0.35} strokeWidth={1.2} fill="none" pathLength={1} strokeDasharray="1" style={anim("es-draw", s.delay)} />
              <path d={s.d} transform={`translate(0 ${s.width * 0.28})`} stroke={lo} strokeOpacity={0.45} strokeWidth={1.4} fill="none" pathLength={1} strokeDasharray="1" style={anim("es-draw", s.delay)} />
            </g>
          ))}
        </>
      );
    }

    default: {
      // grain: dry media with paper tooth and hatching
      const spacing = 5 + (1 - material.roughness) * 5;
      const lines: string[] = [];
      const diag = box.w + box.h;
      for (let o = -box.h; o < box.w; o += spacing) lines.push(`M${box.x + o} ${box.y + box.h}L${box.x + o + box.h} ${box.y}`);
      return (
        <>
          <rect {...rectProps(box)} fill={base} opacity={0.72} mask="url(#es-tooth)" style={anim("es-fade", 0.45)} />
          {lines.map((d, i) => (
            <path key={i} d={d} stroke={i % 3 ? lo : hi} strokeOpacity={0.5} strokeWidth={1.3} fill="none" pathLength={1} strokeDasharray="1" style={anim("es-draw", ((i * spacing) / diag) * 0.6)} />
          ))}
        </>
      );
    }
  }
}

/** One material painted into one region: clip, surface, texture and glow. */
export const PaintLayer = memo(function PaintLayer({ uid, material, region, origin, animate, ambient, exiting }: PaintLayerProps) {
  const box = pad(region.box, 2);
  return (
    <g className={exiting ? "paint-exit" : undefined} style={{ transformOrigin: `${origin[0]}px ${origin[1]}px` }}>
      <defs>
        <clipPath id={`${uid}-clip`}>
          <path d={region.d} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}-clip)`}>
        <Surface uid={uid} material={material} box={box} origin={origin} animate={animate} ambient={ambient} />
        <rect {...rectProps(box)} fill="url(#es-noise)" opacity={0.05 + material.roughness * 0.2} style={{ mixBlendMode: "overlay" }} />
        {material.luminous && <path d={region.d} fill="none" stroke={material.palette[1]} strokeWidth={9} strokeOpacity={0.55} filter="url(#es-blur-sm)" />}
      </g>
    </g>
  );
});
