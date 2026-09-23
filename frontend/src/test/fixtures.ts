import type { Decision, Material, SketchAsset } from "@/types";

const BEHAVIORS = ["liquid", "spray", "watercolor", "ink", "chrome", "pixel", "smoke", "glitter", "lava", "holographic", "grain", "crystal", "impasto"] as const;

export function material(overrides: Partial<Material> = {}): Material {
  return {
    id: "neon-liquid",
    name: "Neon Liquid",
    type: "liquid",
    texture: "glossy",
    colorFamily: "neon",
    palette: ["#ff2bd6", "#ffa6f2", "#5c0460"],
    intensity: 0.9,
    roughness: 0.1,
    viscosity: 0.3,
    luminous: true,
    tags: ["fluid"],
    ...overrides,
  };
}

/** Two materials per behaviour: 26 in total. */
export const MATERIALS: Material[] = BEHAVIORS.flatMap((type, i) =>
  [0, 1].map((k) =>
    material({ id: `${type}-${k}`, name: `${type} ${k}`, type, luminous: k === 0 && i % 2 === 0, roughness: (i % 5) / 5, viscosity: k * 0.5 }),
  ),
);

export function sketch(overrides: Partial<SketchAsset> = {}): SketchAsset {
  return { id: "sk-091", title: "The Watcher", category: "eyes", complexity: 0.6, tags: ["eyes"], seed: 1234, variant: 0, preview: "procedural://eyes/0/1234", ...overrides };
}

export function decision(overrides: Partial<Decision> = {}): Decision {
  const probabilities = { "liquid-0": 0.6, "chrome-0": 0.25, "ink-0": 0.15 };
  return {
    decisionId: "d-1",
    selectedMaterial: "liquid-0",
    probabilities,
    ranking: Object.entries(probabilities).map(([materialId, probability], i) => ({ materialId, probability, rank: i + 1 })),
    confidence: 0.58,
    certainty: "confident",
    treatment: null,
    latencyMs: 320,
    provider: "real",
    model: "jev-1.13.0",
    usage: { inputTokens: 480, outputTokens: 90 },
    ...overrides,
  };
}
