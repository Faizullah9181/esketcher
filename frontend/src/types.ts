/** Wire types mirrored from the FastAPI models (camelCase on the wire). */

export type MaterialBehavior =
  | "liquid"
  | "spray"
  | "watercolor"
  | "ink"
  | "chrome"
  | "pixel"
  | "smoke"
  | "glitter"
  | "lava"
  | "holographic"
  | "grain"
  | "crystal"
  | "impasto";

export type Texture =
  | "glossy"
  | "matte"
  | "grainy"
  | "fibrous"
  | "granular"
  | "faceted"
  | "noisy"
  | "woven"
  | "velvety";

export interface Material {
  id: string;
  name: string;
  type: MaterialBehavior;
  texture: Texture;
  colorFamily: string;
  /** base, highlight, shadow */
  palette: [string, string, string];
  intensity: number;
  roughness: number;
  viscosity: number;
  luminous: boolean;
  tags: string[];
}

export type SketchCategory =
  | "faces"
  | "hands"
  | "flowers"
  | "animals"
  | "insects"
  | "architecture"
  | "geometry"
  | "landscapes"
  | "planets"
  | "creatures"
  | "symbols"
  | "typography"
  | "mechanical"
  | "fashion"
  | "botanical"
  | "surreal"
  | "monsters"
  | "masks"
  | "eyes"
  | "bodies"
  | "objects";

export interface SketchAsset {
  id: string;
  title: string;
  category: SketchCategory;
  complexity: number;
  tags: string[];
  seed: number;
  variant: number;
  preview: string;
}

export type Composition =
  | "center-heavy"
  | "top-heavy"
  | "bottom-heavy"
  | "left-heavy"
  | "right-heavy"
  | "balanced"
  | "scattered";

export interface TargetFeatures {
  kind: string;
  label: string;
  areaRatio: number;
  complexity: number;
  strokeDensity: number;
  symmetry: number;
  composition: Composition;
  dominantColor?: string | null;
}

export type DecisionScope = "region" | "sketch";
export type Certainty = "confident" | "leaning" | "uncertain";
export type TreatmentMode = "focal-accent" | "full-flood" | "duotone" | "spectrum-mix";

export interface PaletteDirection {
  id: string;
  name: string;
  families: string[];
  description: string;
}

export interface PaletteDecision {
  decisionId: string;
  palette: string;
  probabilities: Record<string, number>;
  confidence: number;
  certainty: Certainty;
  latencyMs: number;
  provider: "real" | "mock";
  model: string;
}

export interface DecisionRequest {
  target: TargetFeatures;
  context: { sketchId: string; neighborMaterialIds: string[]; chaos: boolean; palette?: string | null };
  candidateMaterials: string[];
  scope: DecisionScope;
}

export interface RetryRequest extends DecisionRequest {
  rejectedMaterialIds: string[];
  attempt: number;
}

export interface RankedMaterial {
  materialId: string;
  probability: number;
  rank: number;
}

export interface Decision {
  decisionId: string;
  selectedMaterial: string;
  probabilities: Record<string, number>;
  ranking: RankedMaterial[];
  confidence: number;
  certainty: Certainty;
  treatment: { mode: TreatmentMode; probabilities: Record<string, number>; confidence: number } | null;
  latencyMs: number;
  provider: "real" | "mock";
  model: string;
  usage: { inputTokens: number; outputTokens: number } | null;
}

export interface JevHealth {
  mode: "real" | "mock";
  model: string;
  online: boolean;
  latencyMs: number | null;
  availableModels: string[];
  error: string | null;
}

export interface Health {
  status: "ok";
  version: string;
  jev: JevHealth;
}

export interface Project {
  id: string;
  name: string;
  snapshot: Record<string, unknown>;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

/** A material applied to one region of a board. Stored in the desk document. */
export interface Paint {
  /** material id */
  m: string;
  /** applied-at, epoch ms; drives whether the reveal animation plays */
  t: number;
  /** decision id when Jev chose it */
  d?: string;
}
