import { create } from "zustand";

import type { Desk } from "@/lib/desk/desk";

import type {
  Certainty,
  Decision,
  DecisionScope,
  Health,
  Material,
  PaletteDirection,
  SketchAsset,
  TargetFeatures,
} from "@/types";

/** Per-board lifecycle; drives the board's visual state. */
export type SketchState = "idle" | "selected" | "analyzing" | "decision-ready" | "painting" | "painted";

export type Drawer = "none" | "sketches" | "materials" | "experiments" | "sampling";

/** The sampling carousel: boards in order, and which one is on the stage. */
export interface SamplingRun {
  ids: string[];
  cursor: number;
  phase: "ready" | "sliding" | "lifting" | "painting" | "dropping" | "done";
  /** bumps each time a painted sample lands back in the carousel (drives a pulse) */
  landed: number;
}

export interface RegionRef {
  boardId: string;
  regionId: string | null;
}

export interface ActiveDecision {
  key: string;
  boardId: string;
  regionId: string | null;
  scope: DecisionScope;
  status: "analyzing" | "ready" | "error";
  features: TargetFeatures;
  candidates: string[];
  decision?: Decision;
  error?: { code: string; message: string };
  rejected: string[];
  attempt: number;
  autoApply: boolean;
  startedAt: number;
}

export interface HistoryEntry {
  id: string;
  at: number;
  boardId: string;
  regionId: string | null;
  boardTitle: string;
  target: string;
  materialId: string;
  confidence: number;
  certainty: Certainty;
  provider: "real" | "mock" | "manual";
}

export interface Flight {
  id: string;
  materialId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  boardId: string;
  assignments: Record<string, string>;
  decisionId?: string;
}

export interface Burst {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SaveStatus = "loading" | "saved" | "saving" | "dirty" | "offline" | "error";

export interface Simulation {
  status: "idle" | "running" | "paused" | "done" | "error";
  done: number;
  total: number;
  /** what is being painted right now, e.g. "04 · The Watcher / iris" */
  current: string | null;
  error: string | null;
}

export const idleSimulation: Simulation = { status: "idle", done: 0, total: 0, current: null, error: null };

interface StudioState {
  desk: Desk | null;
  materials: Material[];
  materialsById: Map<string, Material>;
  sketches: SketchAsset[];
  palettes: PaletteDirection[];
  health: Health | null;
  healthError: string | null;
  /** the server was unreachable at boot: bundled catalog, local saves, Jev off */
  offline: boolean;

  focus: RegionRef | null;
  hover: RegionRef | null;
  /** transient states only; idle / selected / painted are derived by the board */
  boardState: Record<string, SketchState | undefined>;
  active: ActiveDecision | null;
  history: HistoryEntry[];
  flights: Flight[];
  bursts: Burst[];

  chaos: boolean;
  armedMaterial: string | null;
  pinned: string[];
  drawer: Drawer;
  panelOpen: boolean;
  candidateCount: number;
  autoApplyMin: Certainty;

  projectId: string | null;
  save: SaveStatus;
  savedAt: number | null;
  sim: Simulation;
  sampling: SamplingRun | null;
}

interface StudioActions {
  setDesk(desk: Desk | null): void;
  setCatalog(materials: Material[], sketches: SketchAsset[], palettes?: PaletteDirection[]): void;
  setHealth(health: Health | null, error?: string | null): void;
  setOffline(offline: boolean): void;
  setFocus(focus: RegionRef | null): void;
  setHover(hover: RegionRef | null): void;
  setBoardState(boardId: string, state: SketchState | null): void;
  setActive(active: ActiveDecision | null): void;
  patchActive(key: string, patch: Partial<ActiveDecision>): void;
  pushHistory(entry: HistoryEntry): void;
  setHistory(history: HistoryEntry[]): void;
  addFlight(flight: Flight): void;
  removeFlight(id: string): void;
  addBurst(burst: Burst): void;
  removeBurst(id: string): void;
  toggleChaos(): void;
  arm(materialId: string | null): void;
  togglePin(materialId: string): void;
  setDrawer(drawer: Drawer): void;
  setPanelOpen(open: boolean): void;
  setCandidateCount(count: number): void;
  setAutoApplyMin(min: Certainty): void;
  setProject(projectId: string | null): void;
  setSave(save: SaveStatus): void;
  setSim(patch: Partial<Simulation>): void;
  setSampling(run: SamplingRun | null): void;
  patchSampling(patch: Partial<SamplingRun>): void;
}

export const HISTORY_LIMIT = 60;
export const MAX_PINNED = 6;

export const initialStudio: StudioState = {
  desk: null,
  materials: [],
  materialsById: new Map(),
  sketches: [],
  palettes: [],
  health: null,
  healthError: null,
  offline: false,
  focus: null,
  hover: null,
  boardState: {},
  active: null,
  history: [],
  flights: [],
  bursts: [],
  chaos: false,
  armedMaterial: null,
  pinned: [],
  drawer: "none",
  panelOpen: false,
  candidateCount: 10,
  autoApplyMin: "leaning",
  projectId: null,
  save: "loading",
  savedAt: null,
  sim: idleSimulation,
  sampling: null,
};

export const useStudio = create<StudioState & StudioActions>()((set) => ({
  ...initialStudio,
  setDesk: (desk) => set({ desk }),
  setCatalog: (materials, sketches, palettes) =>
    set((s) => ({ materials, sketches, palettes: palettes ?? s.palettes, materialsById: new Map(materials.map((m) => [m.id, m])) })),
  setHealth: (health, error = null) => set({ health, healthError: error }),
  setOffline: (offline) => set({ offline }),
  setFocus: (focus) => set({ focus }),
  setHover: (hover) =>
    set((s) => (s.hover?.boardId === hover?.boardId && s.hover?.regionId === hover?.regionId ? s : { hover })),
  setBoardState: (boardId, state) =>
    set((s) => {
      if ((s.boardState[boardId] ?? null) === state) return s;
      const next = { ...s.boardState };
      if (state) next[boardId] = state;
      else delete next[boardId];
      return { boardState: next };
    }),
  setActive: (active) => set({ active }),
  patchActive: (key, patch) =>
    set((s) => (s.active?.key === key ? { active: { ...s.active, ...patch } } : s)),
  pushHistory: (entry) => set((s) => ({ history: [entry, ...s.history].slice(0, HISTORY_LIMIT) })),
  setHistory: (history) => set({ history: history.slice(0, HISTORY_LIMIT) }),
  addFlight: (flight) => set((s) => ({ flights: [...s.flights, flight] })),
  removeFlight: (id) => set((s) => ({ flights: s.flights.filter((f) => f.id !== id) })),
  addBurst: (burst) => set((s) => ({ bursts: [...s.bursts, burst] })),
  removeBurst: (id) => set((s) => ({ bursts: s.bursts.filter((b) => b.id !== id) })),
  toggleChaos: () => set((s) => ({ chaos: !s.chaos, candidateCount: s.chaos ? 10 : 14 })),
  arm: (armedMaterial) => set({ armedMaterial }),
  togglePin: (id) =>
    set((s) => ({
      pinned: s.pinned.includes(id) ? s.pinned.filter((p) => p !== id) : [...s.pinned, id].slice(-MAX_PINNED),
    })),
  setDrawer: (drawer) => set((s) => ({ drawer: s.drawer === drawer ? "none" : drawer })),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setCandidateCount: (candidateCount) => set({ candidateCount: Math.min(16, Math.max(2, candidateCount)) }),
  setAutoApplyMin: (autoApplyMin) => set({ autoApplyMin }),
  setProject: (projectId) => set({ projectId }),
  setSave: (save) => set((s) => ({ save, savedAt: save === "saved" ? Date.now() : s.savedAt })),
  setSim: (patch) => set((s) => ({ sim: { ...s.sim, ...patch } })),
  setSampling: (sampling) => set({ sampling }),
  patchSampling: (patch) => set((s) => (s.sampling ? { sampling: { ...s.sampling, ...patch } } : s)),
}));

/** Stats for the idle Jev panel, derived from real decision history. */
export function historyStats(history: HistoryEntry[], now = Date.now()) {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const jev = history.filter((h) => h.provider !== "manual");
  const today = jev.filter((h) => h.at >= startOfDay.getTime());
  const avg = jev.length ? jev.reduce((sum, h) => sum + h.confidence, 0) / jev.length : null;
  return { today: today.length, total: jev.length, avgConfidence: avg };
}
