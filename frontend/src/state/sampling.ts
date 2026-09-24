/**
 * Sampling: N sketches in a carousel under a stage.
 *
 *            ┌──────────── stage ────────────┐
 *            │     the sample Jev paints     │
 *            └───────────────────────────────┘
 *     ┌─────────────────────[ slot ]─────────────────────┐
 *     │  painted ←   1   2   3  [ 4 ]  5   6   7  → queue │
 *     └──────────────────────────────────────────────────┘
 *
 * Play: the centre sample lifts to the stage, Jev paints it (one real decision per
 * region kind), it drops back, and the whole carousel slides one step so painted
 * samples drift to the side. Everything happens on the real desk, so results stay.
 */
import { createBoard } from "@/lib/canvas/boards";
import { animateShapes, easings } from "@/lib/desk/animate";
import type { Desk } from "@/lib/desk/desk";
import type { BoardShape, Rect } from "@/lib/desk/types";
import { createRng } from "@/lib/rng";
import type { SketchAsset, SketchCategory } from "@/types";

import { cancelDecision } from "./jevController";
import { planBoard, runStep } from "./simulation";
import { idleSimulation, useStudio, type SamplingRun } from "./studio";

export const SAMPLE_MIN = 3;
export const SAMPLE_MAX = 30;

// page-space layout
export const ITEM = { w: 176, h: 220 };
export const SLOT = 214;
export const ROW_Y = 600;
export const STAGE: Rect = { x: -216, y: 0, w: 432, h: 540 };
/** visible slots each side of centre */
export const REACH = 3;

let token = 0;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Where sample i sits in the carousel when `cursor` is at the centre. */
export function slotRect(i: number, cursor: number): Rect & { rotation: number } {
  const offset = i - cursor;
  // painted samples (left of centre) lean a little, like cards set down
  const lean = offset < 0 ? ((i * 37) % 7) / 100 - 0.03 : 0;
  return { x: offset * SLOT - ITEM.w / 2, y: ROW_Y, w: ITEM.w, h: ITEM.h, rotation: lean };
}

/** Everything the camera frames: the stage and the carousel window. */
export function samplingBounds(): Rect {
  const left = -(REACH + 0.5) * SLOT;
  return { x: left - 20, y: STAGE.y - 60, w: -left * 2 + 40, h: ROW_Y + ITEM.h + 140 - STAGE.y };
}

/** Pick N sketches: one per category, round-robin, so a run is varied. */
export function pickSamples(sketches: SketchAsset[], count: number, category: SketchCategory | "mixed", seed = Date.now()): SketchAsset[] {
  const rng = createRng(seed);
  const pool = category === "mixed" ? sketches : sketches.filter((s) => s.category === category);
  if (!pool.length) return [];
  const byCategory = new Map<string, SketchAsset[]>();
  for (const s of [...pool].sort(() => rng() - 0.5)) byCategory.set(s.category, [...(byCategory.get(s.category) ?? []), s]);
  const lanes = [...byCategory.values()];
  const out: SketchAsset[] = [];
  for (let round = 0; out.length < count; round++) {
    for (const lane of lanes) if (out.length < count) out.push(lane[round % lane.length]);
  }
  return out;
}

/** Frame the stage and carousel; phones get the stage and centre slot only. */
function frame(desk: Desk) {
  const bounds = samplingBounds();
  const narrow = desk.state.viewport.w < 640;
  const target = narrow ? { x: -SLOT * 1.4, y: bounds.y, w: SLOT * 2.8, h: bounds.h } : bounds;
  desk.zoomToBounds(target, { inset: narrow ? 8 : 24, targetZoom: 1.2 });
}

/** Replace the desk with a carousel of `count` samples (one undo step restores the old desk). */
export function buildSampling(count: number, category: SketchCategory | "mixed" = "mixed"): string[] {
  const { desk, sketches, setSampling, setSim } = useStudio.getState();
  if (!desk) return [];
  stopSampling();
  const picks = pickSamples(sketches, Math.max(SAMPLE_MIN, Math.min(SAMPLE_MAX, count)), category);
  let ids: string[] = [];
  desk.transact(() => {
    desk.clear();
    ids = picks.map((sketch, i) => {
      const r = slotRect(i, 0);
      const id = createBoard(desk, sketch, { x: r.x, y: r.y });
      desk.updateShape<BoardShape>(id, { w: r.w, h: r.h });
      return id;
    });
  });
  desk.selectNone();
  setSampling({ ids, cursor: 0, phase: "ready", landed: 0 });
  setSim({ ...idleSimulation, total: ids.length });
  frame(desk);
  return ids;
}

/** Slide every sample to its slot for `cursor`. */
function slide(desk: Desk, run: SamplingRun, cursor: number, ms = 620) {
  const targets = Object.fromEntries(run.ids.map((id, i) => [id, slotRect(i, cursor)]));
  return animateShapes(desk, targets, ms, easings.outBack);
}

/** Victory lap: whip back through every painted sample, then settle in the middle. */
async function finale(desk: Desk, run: SamplingRun, alive: () => boolean) {
  useStudio.getState().patchSampling({ phase: "sliding" });
  for (let c = run.ids.length - 1; c >= 0 && alive(); c--) {
    useStudio.getState().patchSampling({ cursor: c });
    await slide(desk, run, c, 170);
  }
  const middle = Math.floor((run.ids.length - 1) / 2);
  useStudio.getState().patchSampling({ cursor: run.ids.length });
  if (alive()) await slide(desk, run, middle, 900);
}

export async function playSampling(): Promise<void> {
  const store = useStudio.getState();
  const desk = store.desk;
  const run = store.sampling;
  if (!desk || !run || store.sim.status === "running") return;
  if (run.cursor >= run.ids.length) {
    // played through already: rewind for a fresh pass (samples get repainted)
    store.patchSampling({ cursor: 0, phase: "ready" });
  }
  const me = ++token;
  const alive = () => me === token && useStudio.getState().sim.status === "running";
  desk.setInteractive(false);
  desk.selectNone();
  store.setSim({ status: "running", error: null, total: run.ids.length, done: useStudio.getState().sampling!.cursor });
  frame(desk);

  try {
    while (alive()) {
      const current = useStudio.getState().sampling!;
      const cursor = current.cursor;
      if (cursor >= current.ids.length) break;
      const id = current.ids[cursor];
      const board = desk.getShape<BoardShape>(id);
      if (!board) {
        useStudio.getState().patchSampling({ cursor: cursor + 1 });
        continue;
      }

      // 1. the carousel brings this sample to the centre
      useStudio.getState().patchSampling({ phase: "sliding" });
      await slide(desk, current, cursor);
      if (!alive()) break;

      // 2. it pops, then flies up onto the stage
      useStudio.getState().patchSampling({ phase: "lifting" });
      desk.bringToFront([id]);
      const slot = slotRect(cursor, cursor);
      await animateShapes(desk, { [id]: { x: slot.x - 10, y: slot.y - 24, w: slot.w + 20, h: slot.h + 25, rotation: -0.04 } }, 160, easings.outExpo);
      await animateShapes(desk, { [id]: { ...STAGE, rotation: 0 } }, 560, easings.outExpo);
      if (!alive()) break;

      // 3. Jev paints it, one decision per region kind
      useStudio.getState().patchSampling({ phase: "painting" });
      const onStage = desk.getShape<BoardShape>(id)!;
      // an already-painted sample (a second pass) gets repainted
      const steps = planBoard(onStage).length ? planBoard(onStage) : planBoard(onStage, true);
      useStudio.getState().setSim({ current: `${board.props.title} · ${steps.length} decisions` });
      for (const step of steps) {
        if (!alive()) break;
        useStudio.getState().setSim({ current: step.label });
        if (!(await runStep(step))) {
          desk.setInteractive(true);
          return;
        }
        await sleep(120);
      }
      if (!alive()) break;
      useStudio.getState().setFocus(null);

      // 4. back down into its slot, and the carousel moves on
      useStudio.getState().patchSampling({ phase: "dropping" });
      await animateShapes(desk, { [id]: slotRect(cursor, cursor) }, 480, easings.inBack);
      const next = cursor + 1;
      useStudio.getState().patchSampling({ cursor: next, landed: useStudio.getState().sampling!.landed + 1 });
      useStudio.getState().setSim({ done: next });
      if (next >= current.ids.length) await finale(desk, useStudio.getState().sampling!, alive);
    }
  } finally {
    const finished = useStudio.getState().sampling;
    if (me === token) {
      desk.setInteractive(true);
      // one real commit so the final positions are saved
      desk.updateShapes({});
      if (finished && finished.cursor >= finished.ids.length) {
        useStudio.getState().patchSampling({ phase: "done" });
        useStudio.getState().setSim({ status: "done", current: null });
        setTimeout(() => me === token && useStudio.getState().sim.status === "done" && useStudio.getState().setSim(idleSimulation), 2400);
      } else if (finished) useStudio.getState().patchSampling({ phase: "ready" });
    }
  }
}

export function pauseSampling(): void {
  if (useStudio.getState().sim.status === "running") useStudio.getState().setSim({ status: "paused" });
}

/** Stop and leave everything where it is; the carousel is dissolved into ordinary boards. */
export function stopSampling(): void {
  token++;
  const { desk, sampling } = useStudio.getState();
  if (sampling) cancelDecision();
  desk?.setInteractive(true);
  useStudio.getState().setSampling(null);
  useStudio.getState().setSim(idleSimulation);
}

/** Start over with the same samples: paints kept, carousel back to the first. */
export function rewindSampling(): void {
  const { desk, sampling } = useStudio.getState();
  if (!desk || !sampling || useStudio.getState().sim.status === "running") return;
  useStudio.getState().patchSampling({ cursor: 0, phase: "ready" });
  useStudio.getState().setSim({ ...idleSimulation, total: sampling.ids.length });
  void slide(desk, { ...sampling, cursor: 0 }, 0);
}
