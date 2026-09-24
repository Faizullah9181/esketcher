import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { boardArt } from "@/lib/canvas/boards";
import type { Desk } from "@/lib/desk/desk";
import { ApiError, api } from "@/services/api";
import { boardOf, setupDesk } from "@/test/desk";
import { decision } from "@/test/fixtures";

import { landFlight, resetControllerState } from "./jevController";
import { isSimulating, pauseSimulation, planSimulation, startSimulation, stopSimulation } from "./simulation";
import { useStudio } from "./studio";

let desk: Desk;
let ids: string[];

beforeEach(() => {
  vi.useFakeTimers();
  resetControllerState();
  ({ desk, ids } = setupDesk(2));
  // flights land as soon as they launch; the real app lands them on animation end
  useStudio.subscribe((s, prev) => {
    if (s.flights.length > prev.flights.length) queueMicrotask(() => landFlight(s.flights.at(-1)!.id));
  });
});

afterEach(() => {
  stopSimulation();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("planSimulation", () => {
  it("asks once per region kind per board", () => {
    const plan = planSimulation();
    const kinds = new Set(plan.filter((s) => s.boardId === ids[0]).map((s) => s.label));
    expect(kinds.size).toBe(plan.filter((s) => s.boardId === ids[0]).length);
    const covered = plan.filter((s) => s.boardId === ids[0]).flatMap((s) => [s.regionId, ...s.applyTo]);
    expect(covered.sort()).toEqual(boardArt(boardOf(desk, ids[0])).regions.map((r) => r.id).sort());
    expect(plan[0].label).toMatch(/^01 · Board 1 \//);
  });

  it("skips locked boards and repaints a full desk", () => {
    desk.toggleLock([ids[1]]);
    expect(planSimulation().every((s) => s.boardId === ids[0])).toBe(true);
    const plan = planSimulation();
    for (const step of plan) {
      const board = boardOf(desk, step.boardId);
      desk.updateShape(step.boardId, { props: { ...board.props, paints: { ...board.props.paints, ...Object.fromEntries([step.regionId, ...step.applyTo].map((r) => [r, { m: "ink-0", t: 0 }])) } } });
    }
    expect(planSimulation().length).toBe(plan.length);
    useStudio.setState({ desk: null });
    expect(planSimulation()).toEqual([]);
  });
});

describe("startSimulation", () => {
  it("fills every region on every board", async () => {
    vi.spyOn(api, "decide").mockResolvedValue(decision({ certainty: "uncertain", confidence: 0.2 }));
    const total = planSimulation().length;
    const seen: string[] = [];
    useStudio.subscribe((s) => seen.push(`${s.sim.status}:${s.sim.done}`));
    const run = startSimulation();
    expect(isSimulating()).toBe(true);
    for (let i = 0; i < total * 10 && useStudio.getState().sim.status !== "done"; i++) await vi.advanceTimersByTimeAsync(300);
    await run;
    expect(useStudio.getState().sim).toMatchObject({ status: "done", done: total, total });
    expect(seen).toContain(`running:${total - 1}`);
    for (const id of ids) {
      const board = boardOf(desk, id);
      expect(Object.keys(board.props.paints).sort()).toEqual(boardArt(board).regions.map((r) => r.id).sort());
    }
    await vi.advanceTimersByTimeAsync(3000);
    expect(useStudio.getState().sim.status).toBe("idle");
  });

  it("pauses after the current step and resumes where it left off", async () => {
    vi.spyOn(api, "decide").mockResolvedValue(decision());
    void startSimulation();
    void startSimulation(); // already running: ignored
    await vi.advanceTimersByTimeAsync(2500);
    pauseSimulation();
    await vi.advanceTimersByTimeAsync(4000);
    const paused = useStudio.getState().sim;
    expect(paused.status).toBe("paused");
    expect(paused.done).toBeGreaterThan(0);
    void startSimulation();
    await vi.advanceTimersByTimeAsync(1000);
    expect(useStudio.getState().sim.done).toBeGreaterThanOrEqual(paused.done);
    stopSimulation();
    expect(useStudio.getState().sim.status).toBe("idle");
    pauseSimulation();
  });

  it("stops with a native error when Jev fails", async () => {
    vi.spyOn(api, "decide").mockRejectedValue(new ApiError(503, "jev_unavailable", "Jev is down"));
    const run = startSimulation();
    await vi.advanceTimersByTimeAsync(3000);
    await run;
    expect(useStudio.getState().sim).toMatchObject({ status: "error", error: "Jev is down" });
  });

  it("skips boards deleted mid-run and does nothing on an empty desk", async () => {
    vi.spyOn(api, "decide").mockResolvedValue(decision());
    void startSimulation();
    desk.deleteShapes([ids[1]]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(useStudio.getState().sim.status).not.toBe("error");
    stopSimulation();
    setupDesk(0);
    await startSimulation();
    expect(useStudio.getState().sim.status).toBe("idle");
  });
});
