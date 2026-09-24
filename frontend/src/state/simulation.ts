/**
 * Play: Jev fills every sketch on the desk.
 *
 * One real decision per region *kind* per board (all petals, all windows…), so a
 * full desk costs a few dozen Jev calls, not hundreds. Every step goes through the
 * normal decision loop: the panel shows the field, the paint flies from the rail.
 */
import { boardArt, focusBoard, listBoards } from "@/lib/canvas/boards";
import { groupBy } from "@/lib/collections";
import type { BoardShape } from "@/lib/desk/types";

import { cancelDecision, requestDecision, waitForLanding } from "./jevController";
import { idleSimulation, useStudio } from "./studio";

export interface SimStep {
  boardId: string;
  /** the region Jev is asked about */
  regionId: string;
  /** other regions of the same kind that receive the same material */
  applyTo: string[];
  label: string;
}

const CAMERA_SETTLE_MS = 700;
const STEP_GAP_MS = 220;

let queue: SimStep[] = [];
let token = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One board's steps: its regions grouped by kind, biggest kinds first (the background
 * settles before the details). `repaint` includes already-painted regions. */
export function planBoard(board: BoardShape, repaint = false): SimStep[] {
  const regions = boardArt(board).regions.filter((r) => repaint || !board.props.paints[r.id]);
  return groupBy(regions, (r) => r.kind)
    .sort(([, a], [, b]) => b.reduce((s, r) => s + r.area, 0) - a.reduce((s, r) => s + r.area, 0))
    .map(([kind, members]) => {
      const lead = members.find((r) => r.focal) ?? members[0];
      return {
        boardId: board.id,
        regionId: lead.id,
        applyTo: members.filter((r) => r.id !== lead.id).map((r) => r.id),
        label: `${String(board.props.num).padStart(2, "0")} · ${board.props.title} / ${members.length > 1 ? `${kind} ×${members.length}` : lead.label}`,
      };
    });
}

/** Unpainted regions, board by board. Repaints everything once the desk is full. */
export function planSimulation(): SimStep[] {
  const desk = useStudio.getState().desk;
  if (!desk) return [];
  const boards = listBoards(desk)
    .filter((b) => !b.locked)
    .sort((a, b) => a.props.num - b.props.num);
  const fresh = boards.flatMap((b) => planBoard(b));
  return fresh.length ? fresh : boards.flatMap((b) => planBoard(b, true));
}

/** Errors worth another try after a pause: the connection, not the question. */
const TRANSIENT = new Set(["network", "jev_unavailable", "jev_timeout", "rate_limited"]);
/** Waits between retries of one step, so a long unattended run survives a hiccup. */
export const retryPolicy = { backoffMs: [1500, 4000] };

/**
 * Run one step through the real decision loop. A transient Jev failure is retried
 * after a pause; false when Jev stayed down (sim goes to "error") or the run was
 * paused or stopped while waiting.
 */
export async function runStep(step: SimStep): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    useStudio.getState().setFocus({ boardId: step.boardId, regionId: step.regionId });
    const outcome = await requestDecision({ boardId: step.boardId, regionId: step.regionId, autoApply: true, force: true, applyTo: step.applyTo });
    if (outcome) {
      if (outcome.flightId) await waitForLanding(outcome.flightId);
      return true;
    }
    const active = useStudio.getState().active;
    if (active?.status !== "error") return true; // cancelled, not failed
    const wait = retryPolicy.backoffMs[attempt];
    if (wait === undefined || !TRANSIENT.has(active.error?.code ?? "")) {
      useStudio.getState().setSim({ status: "error", error: active.error?.message ?? "Jev connection interrupted" });
      return false;
    }
    useStudio.getState().setSim({ current: `Jev hiccup · retrying in ${Math.round(wait / 1000)}s` });
    await sleep(wait);
    if (!isSimulating()) return false;
  }
}

export async function startSimulation(): Promise<void> {
  const store = useStudio.getState();
  if (store.sim.status === "running") return;
  if (store.sim.status !== "paused" || !queue.length) {
    queue = planSimulation();
    store.setSim({ ...idleSimulation, total: queue.length });
  }
  if (!queue.length) return;
  const run = ++token;
  store.setSim({ status: "running", error: null });
  let lastBoard: string | null = null;

  while (queue.length && run === token && useStudio.getState().sim.status === "running") {
    const step = queue[0];
    const desk = useStudio.getState().desk;
    if (!desk?.getShape(step.boardId)) {
      queue.shift();
      continue;
    }
    useStudio.getState().setSim({ current: step.label });
    // focus first, so selecting the board doesn't flash "whole sketch" in the panel
    useStudio.getState().setFocus({ boardId: step.boardId, regionId: step.regionId });
    if (step.boardId !== lastBoard) {
      focusBoard(desk, step.boardId);
      lastBoard = step.boardId;
      await sleep(CAMERA_SETTLE_MS);
      if (run !== token) return;
    }
    const ok = await runStep(step);
    if (run !== token || !ok) return;
    queue.shift();
    useStudio.getState().setSim({ done: useStudio.getState().sim.done + 1 });
    await sleep(STEP_GAP_MS);
  }

  if (run === token && !queue.length) {
    useStudio.getState().setSim({ status: "done", current: null });
    useStudio.getState().desk?.zoomToFit();
    setTimeout(() => run === token && useStudio.getState().sim.status === "done" && useStudio.getState().setSim(idleSimulation), 2400);
  }
}

/** Finish the current step, then hold. */
export function pauseSimulation(): void {
  if (useStudio.getState().sim.status === "running") useStudio.getState().setSim({ status: "paused" });
}

export function stopSimulation(): void {
  token++;
  queue = [];
  cancelDecision();
  useStudio.getState().setSim(idleSimulation);
}

export function isSimulating(): boolean {
  return useStudio.getState().sim.status === "running";
}
