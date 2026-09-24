/**
 * The signature loop: SELECT → ANALYZE → CANDIDATES → JEV DECIDES → FLIGHT → PAINT.
 *
 * Plain functions over the zustand store so tools, panels and history can all
 * drive it. Every decision comes from the backend; nothing here invents one.
 */
import { chipRect } from "@/components/MaterialRail/registry";
import { analyzeTarget } from "@/lib/analysis/analyzer";
import { applyPaints, boardArt, focusBoard, isBoard, listBoards, regionScreenPoint } from "@/lib/canvas/boards";
import type { BoardShape } from "@/lib/desk/types";
import { shortlist } from "@/lib/jev/candidates";
import { distribute } from "@/lib/jev/treatment";
import { longestReveal } from "@/lib/paintEngine/recipes";
import { createRng, hashString } from "@/lib/rng";
import { ApiError, api, isAbort } from "@/services/api";
import type { Certainty, Decision, DecisionRequest, Material } from "@/types";

import { useStudio, type HistoryEntry, type RegionRef } from "./studio";

const CERTAINTY_RANK: Record<Certainty, number> = { uncertain: 0, leaning: 1, confident: 2 };
const MIN_THINK_MS = 380;
const CACHE_TTL_MS = 5 * 60_000;

let inflight: AbortController | null = null;
let backgroundBusy = false;
const cache = new Map<string, { decision: Decision; at: number }>();

export const targetKey = (boardId: string, regionId: string | null) => `${boardId}|${regionId ?? "*"}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const uid = () => Math.random().toString(36).slice(2, 10);

export function passesThreshold(certainty: Certainty, min: Certainty): boolean {
  return CERTAINTY_RANK[certainty] >= CERTAINTY_RANK[min];
}

function getBoard(boardId: string): BoardShape | null {
  const shape = useStudio.getState().desk?.getShape(boardId);
  return isBoard(shape) ? shape : null;
}

export interface DecisionOutcome {
  decision: Decision;
  /** set when the decision launched a paint flight */
  flightId?: string;
}

const landings = new Map<string, () => void>();

/** Resolves when a flight lands (or after `timeoutMs`, so a hidden tab never stalls a run). */
export function waitForLanding(flightId: string, timeoutMs = 4000): Promise<void> {
  if (!useStudio.getState().flights.some((f) => f.id === flightId)) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      landings.delete(flightId);
      landFlight(flightId);
      resolve();
    }, timeoutMs);
    landings.set(flightId, () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

interface DecideOptions extends RegionRef {
  autoApply: boolean;
  retry?: boolean;
  /** chaos-mode decisions: don't take over the panel or the user's selection */
  background?: boolean;
  /** apply whatever Jev picks, however uncertain (the simulation fills everything) */
  force?: boolean;
  /** paint these regions with the winner too (e.g. every petal) */
  applyTo?: string[];
}

export async function requestDecision({ boardId, regionId, autoApply, retry = false, background = false, force = false, applyTo }: DecideOptions): Promise<DecisionOutcome | null> {
  const store = useStudio.getState();
  const board = getBoard(boardId);
  if (!board || board.locked || !store.materials.length) return null;
  if (background && (backgroundBusy || store.active?.status === "analyzing")) return null;

  if (board.props.lockedMaterial) {
    if (autoApply) applyManual(board.props.lockedMaterial, { boardId, regionId });
    return null;
  }

  const art = boardArt(board);
  const region = regionId ? (art.regions.find((r) => r.id === regionId) ?? null) : null;
  const key = targetKey(boardId, region?.id ?? null);
  const features = analyzeTarget(art, region, board.props.complexity, board.props.paints, store.materialsById);
  const previous = store.active?.key === key ? store.active : null;
  const rejected = retry && previous ? [...new Set([...previous.rejected, ...(previous.decision ? [previous.decision.selectedMaterial] : [])])] : [];
  const attempt = retry ? (previous?.attempt ?? 1) + 1 : 1;
  const scope = region ? "region" : "sketch";
  const neighborMaterialIds = [
    ...new Set(Object.entries(board.props.paints).filter(([id]) => id !== region?.id).map(([, p]) => p.m)),
  ].slice(0, 24);
  const startedAt = Date.now();
  let candidates: string[] = [];

  let signal: AbortSignal | undefined;
  if (background) backgroundBusy = true;
  else {
    inflight?.abort();
    inflight = new AbortController();
    signal = inflight.signal;
    store.setActive({ key, boardId, regionId: region?.id ?? null, scope, status: "analyzing", features, candidates, rejected, attempt, autoApply, startedAt });
  }
  store.setBoardState(boardId, "analyzing");

  try {
    // colour plan first: the board's palette decides which materials Jev chooses between
    const paletteId = await ensurePalette(board, signal);
    const palette = useStudio.getState().palettes.find((p) => p.id === paletteId) ?? null;
    const painted = neighborMaterialIds.map((id) => store.materialsById.get(id)).filter((m): m is Material => Boolean(m));
    candidates = shortlist(store.materials, features, {
      count: store.candidateCount,
      seed: hashString(key) + attempt * 7919,
      exclude: rejected,
      include: store.pinned,
      palette,
      painted,
    });
    if (!background) useStudio.getState().patchActive(key, { candidates });
    const body: DecisionRequest = {
      target: features,
      context: { sketchId: board.props.sketchId, neighborMaterialIds, chaos: store.chaos, palette: paletteId },
      candidateMaterials: candidates,
      scope,
    };
    const cacheKey = JSON.stringify(body);
    const hit = retry ? undefined : cache.get(cacheKey);
    const fresh = !hit || Date.now() - hit.at > CACHE_TTL_MS;
    const decision = fresh
      ? retry
        ? await api.retry({ ...body, rejectedMaterialIds: rejected, attempt }, signal)
        : await api.decide(body, signal)
      : hit.decision;
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_THINK_MS) await sleep(MIN_THINK_MS - elapsed);
    if (signal?.aborted) return null;
    cache.set(cacheKey, { decision, at: fresh ? Date.now() : hit!.at });

    if (!background) useStudio.getState().patchActive(key, { status: "ready", decision });
    useStudio.getState().setBoardState(boardId, "decision-ready");
    if (fresh) record(board, region?.label ?? "whole sketch", region?.id ?? null, decision);

    const outcome: DecisionOutcome = { decision };
    if (autoApply && (force || passesThreshold(decision.certainty, useStudio.getState().autoApplyMin))) {
      await sleep(450); // let the probability bars land before the paint leaves the rail
      if (signal?.aborted) return null;
      outcome.flightId = apply({ boardId, regionId: region?.id ?? null, decision, materialId: decision.selectedMaterial, applyTo });
    }
    return outcome;
  } catch (error) {
    if (isAbort(error)) return null;
    const detail = error instanceof ApiError ? { code: error.code, message: error.message } : { code: "unknown", message: String(error) };
    if (!background) useStudio.getState().patchActive(key, { status: "error", error: detail });
    useStudio.getState().setBoardState(boardId, null);
    return null;
  } finally {
    if (background) backgroundBusy = false;
  }
}

/** The board's palette direction: asked of Jev once, then kept on the board. Never blocks painting. */
async function ensurePalette(board: BoardShape, signal?: AbortSignal): Promise<string | null> {
  if (board.props.palette) return board.props.palette;
  const store = useStudio.getState();
  if (!store.palettes.length || !store.desk) return null;
  const features = analyzeTarget(boardArt(board), null, board.props.complexity, board.props.paints, store.materialsById);
  const neighborMaterialIds = [...new Set(Object.values(board.props.paints).map((p) => p.m))].slice(0, 24);
  try {
    const decision = await api.palette({ target: features, context: { sketchId: board.props.sketchId, neighborMaterialIds, chaos: store.chaos } }, signal);
    const current = store.desk.getShape<BoardShape>(board.id);
    // silent: it travels to history and autosave with the first paint
    if (current) store.desk.patchSilently({ [board.id]: { props: { ...current.props, palette: decision.palette } } });
    return decision.palette;
  } catch (error) {
    if (isAbort(error)) throw error;
    return null;
  }
}

function record(board: BoardShape, target: string, regionId: string | null, decision: Decision): void {
  const entry: HistoryEntry = {
    id: decision.decisionId,
    at: Date.now(),
    boardId: board.id,
    regionId,
    boardTitle: board.props.title,
    target,
    materialId: decision.selectedMaterial,
    confidence: decision.confidence,
    certainty: decision.certainty,
    provider: decision.provider,
  };
  useStudio.getState().pushHistory(entry);
}

export function retryDecision(): void {
  const active = useStudio.getState().active;
  if (!active) return;
  void requestDecision({ boardId: active.boardId, regionId: active.regionId, autoApply: false, retry: true });
}

export function cancelDecision(): void {
  inflight?.abort();
  const active = useStudio.getState().active;
  if (active) useStudio.getState().setBoardState(active.boardId, null);
  useStudio.getState().setActive(null);
}

/** Apply the active decision's winner (or an override from its field). */
export function applyActive(materialId?: string): void {
  const active = useStudio.getState().active;
  if (!active?.decision) return;
  apply({ boardId: active.boardId, regionId: active.regionId, decision: active.decision, materialId: materialId ?? active.decision.selectedMaterial });
}

function apply({ boardId, regionId, decision, materialId, applyTo }: RegionRef & { decision: Decision; materialId: string; applyTo?: string[] }): string | undefined {
  const board = getBoard(boardId);
  if (!board) return undefined;
  const art = boardArt(board);
  const assignments =
    regionId !== null
      ? Object.fromEntries([regionId, ...(applyTo ?? [])].map((id) => [id, materialId]))
      : materialId === decision.selectedMaterial
        ? distribute(decision, art.regions)
        : Object.fromEntries(art.regions.map((r) => [r.id, materialId]));
  return launch(board, regionId, materialId, assignments, decision.decisionId);
}

/** Manual override: paint without asking Jev. Returns false when there is no target. */
export function applyManual(materialId: string, target?: RegionRef | null, from?: DOMRect): boolean {
  const store = useStudio.getState();
  const ref = target ?? store.focus;
  const board = ref ? getBoard(ref.boardId) : null;
  if (!ref || !board || board.locked) {
    store.arm(materialId);
    return false;
  }
  const art = boardArt(board);
  const assignments = ref.regionId ? { [ref.regionId]: materialId } : Object.fromEntries(art.regions.map((r) => [r.id, materialId]));
  store.pushHistory({
    id: uid(),
    at: Date.now(),
    boardId: board.id,
    regionId: ref.regionId,
    boardTitle: board.props.title,
    target: ref.regionId ? (art.regions.find((r) => r.id === ref.regionId)?.label ?? "region") : "whole sketch",
    materialId,
    confidence: 1,
    certainty: "confident",
    provider: "manual",
  });
  launch(board, ref.regionId, materialId, assignments, undefined, from);
  return true;
}

function launch(board: BoardShape, regionId: string | null, materialId: string, assignments: Record<string, string>, decisionId?: string, from?: DOMRect): string | undefined {
  const store = useStudio.getState();
  const desk = store.desk;
  if (!desk) return undefined;
  const region = regionId ? (boardArt(board).regions.find((r) => r.id === regionId) ?? null) : null;
  const to = regionScreenPoint(desk, board, region);
  const origin = from ?? chipRect(materialId);
  const start = origin
    ? { x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 }
    : { x: window.innerWidth / 2, y: window.innerHeight - 70 };
  const id = uid();
  // on phones and tablets the panel covers the desk: get out of the way so the paint is visible
  if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 1023px)").matches) store.setPanelOpen(false);
  store.setBoardState(board.id, "painting");
  store.addFlight({ id, materialId, from: start, to: { x: to.x, y: to.y }, boardId: board.id, assignments, decisionId });
  return id;
}

/** Called by the flight overlay when the thumbnail reaches its target. */
export function landFlight(flightId: string): void {
  const store = useStudio.getState();
  const flight = store.flights.find((f) => f.id === flightId);
  store.removeFlight(flightId);
  landings.get(flightId)?.();
  landings.delete(flightId);
  if (!flight || !store.desk) return;
  applyPaints(store.desk, flight.boardId, flight.assignments, flight.decisionId);
  setTimeout(() => {
    const state = useStudio.getState();
    if (state.boardState[flight.boardId] === "painting") state.setBoardState(flight.boardId, null);
  }, longestReveal(Object.values(flight.assignments).map((id) => useStudio.getState().materialsById.get(id))));
}

/** History replay: glide to the board and paint the same decision again. */
export function replay(entry: HistoryEntry): void {
  const store = useStudio.getState();
  const board = getBoard(entry.boardId);
  if (!board || !store.desk) return;
  focusBoard(store.desk, board.id);
  store.setFocus({ boardId: board.id, regionId: entry.regionId });
  setTimeout(() => {
    const fresh = getBoard(entry.boardId);
    if (!fresh) return;
    const art = boardArt(fresh);
    const assignments = entry.regionId ? { [entry.regionId]: entry.materialId } : Object.fromEntries(art.regions.map((r) => [r.id, entry.materialId]));
    launch(fresh, entry.regionId, entry.materialId, assignments, entry.provider === "manual" ? undefined : entry.id);
  }, 700);
}

/** One ambient chaos decision on a random visible board. */
export function chaosTick(random = createRng(Date.now())): void {
  const desk = useStudio.getState().desk;
  if (!desk || document.hidden) return;
  const visible = listBoards(desk).filter((b) => desk.isVisible(b.id) && !b.locked);
  if (!visible.length) return;
  const board = random.pick(visible);
  const regions = boardArt(board).regions;
  const unpainted = regions.filter((r) => !board.props.paints[r.id]);
  const region = random.pick(unpainted.length ? unpainted : regions);
  if (region) void requestDecision({ boardId: board.id, regionId: region.id, autoApply: true, background: true });
}

/** Test hook. */
export function resetControllerState(): void {
  inflight?.abort();
  inflight = null;
  backgroundBusy = false;
  cache.clear();
  landings.clear();
}
