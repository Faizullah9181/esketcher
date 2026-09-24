import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { boardArt } from "@/lib/canvas/boards";
import { motion } from "@/lib/desk/animate";
import type { Desk } from "@/lib/desk/desk";
import type { BoardShape } from "@/lib/desk/types";
import { ApiError, api } from "@/services/api";
import { setupDesk } from "@/test/desk";
import { decision, sketch } from "@/test/fixtures";
import type { SketchCategory } from "@/types";

import { landFlight, resetControllerState } from "./jevController";
import { ITEM, ROW_Y, SAMPLE_MAX, SLOT, STAGE, buildSampling, pauseSampling, pickSamples, playSampling, rewindSampling, samplingBounds, slotRect, stopSampling } from "./sampling";
import { useStudio } from "./studio";

const CATEGORIES: SketchCategory[] = ["eyes", "flowers", "mechanical", "faces"];
let desk: Desk;

beforeEach(() => {
  vi.useFakeTimers();
  motion.scale = 0;
  resetControllerState();
  ({ desk } = setupDesk(2));
  useStudio.getState().setCatalog(useStudio.getState().materials, CATEGORIES.flatMap((category, c) => [0, 1].map((v) => sketch({ id: `sk-${c}${v}`, category, variant: v, title: `${category} ${v}` }))));
  useStudio.subscribe((s, prev) => {
    if (s.flights.length > prev.flights.length) queueMicrotask(() => landFlight(s.flights.at(-1)!.id));
  });
});

afterEach(() => {
  stopSampling();
  motion.scale = 1;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const boards = () => desk.getShapes().filter((s): s is BoardShape => s.type === "board");
const runUntil = async (predicate: () => boolean, limit = 400) => {
  for (let i = 0; i < limit && !predicate(); i++) await vi.advanceTimersByTimeAsync(250);
};

describe("layout", () => {
  it("places samples in slots around the centre, painted ones leaning", () => {
    expect(slotRect(3, 3)).toEqual({ x: -ITEM.w / 2, y: ROW_Y, w: ITEM.w, h: ITEM.h, rotation: 0 });
    expect(slotRect(5, 3).x).toBe(2 * SLOT - ITEM.w / 2);
    expect(Math.abs(slotRect(1, 3).rotation)).toBeGreaterThan(0);
    const b = samplingBounds();
    expect(b.x).toBeLessThan(STAGE.x);
    expect(b.y + b.h).toBeGreaterThan(ROW_Y + ITEM.h);
  });

  it("picks varied samples round-robin across categories", () => {
    const all = useStudio.getState().sketches;
    const picks = pickSamples(all, 6, "mixed", 1);
    expect(new Set(picks.slice(0, 4).map((s) => s.category)).size).toBe(4);
    expect(pickSamples(all, 5, "eyes", 1).every((s) => s.category === "eyes")).toBe(true);
    expect(pickSamples(all, 3, "hands", 1)).toEqual([]);
  });
});

describe("buildSampling", () => {
  it("replaces the desk with a carousel, undoable in one step", () => {
    const ids = buildSampling(5);
    expect(ids).toHaveLength(5);
    expect(boards()).toHaveLength(5);
    expect(useStudio.getState().sampling).toMatchObject({ ids, cursor: 0, phase: "ready" });
    expect(desk.getShape(ids[0])).toMatchObject({ w: ITEM.w, h: ITEM.h, y: ROW_Y });
    desk.undo();
    expect(boards()).toHaveLength(2);
  });

  it("clamps the sample count", () => {
    expect(buildSampling(1)).toHaveLength(3);
    expect(buildSampling(99)).toHaveLength(SAMPLE_MAX);
    useStudio.setState({ desk: null });
    expect(buildSampling(4)).toEqual([]);
  });
});

describe("playSampling", () => {
  it("lifts each sample to the stage, paints it fully, and slides the carousel on", async () => {
    vi.spyOn(api, "decide").mockResolvedValue(decision({ certainty: "uncertain", confidence: 0.1 }));
    const ids = buildSampling(3);
    const phases = new Set<string>();
    useStudio.subscribe((s) => s.sampling && phases.add(s.sampling.phase));
    const run = playSampling();
    expect(desk.state.interactive).toBe(false);
    await runUntil(() => useStudio.getState().sim.status === "done");
    await run;
    expect([...phases]).toEqual(expect.arrayContaining(["sliding", "lifting", "painting", "dropping", "done"]));
    for (const id of ids) {
      const b = desk.getShape<BoardShape>(id)!;
      expect(Object.keys(b.props.paints).sort()).toEqual(boardArt(b).regions.map((r) => r.id).sort());
      expect(b.w).toBe(ITEM.w); // every sample is back in the carousel
    }
    expect(useStudio.getState().sampling?.cursor).toBe(3);
    expect(desk.state.interactive).toBe(true);
    await vi.advanceTimersByTimeAsync(3000);
    expect(useStudio.getState().sim.status).toBe("idle");
  });

  it("plays again after finishing, repainting from the first sample", async () => {
    const decide = vi.spyOn(api, "decide").mockResolvedValue(decision());
    buildSampling(3);
    void playSampling();
    await runUntil(() => useStudio.getState().sim.status === "done");
    const calls = decide.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3000);
    void playSampling();
    await vi.advanceTimersByTimeAsync(2000);
    expect(decide.mock.calls.length).toBeGreaterThan(calls);
    stopSampling();
  });

  it("pauses between samples and resumes", async () => {
    vi.spyOn(api, "decide").mockResolvedValue(decision());
    buildSampling(4);
    void playSampling();
    void playSampling(); // already running
    await runUntil(() => (useStudio.getState().sampling?.cursor ?? 0) >= 1);
    pauseSampling();
    await runUntil(() => useStudio.getState().sampling?.phase === "ready", 40);
    const paused = useStudio.getState().sampling!.cursor;
    expect(useStudio.getState().sim.status).toBe("paused");
    expect(desk.state.interactive).toBe(true);
    void playSampling();
    await runUntil(() => useStudio.getState().sim.status === "done");
    expect(useStudio.getState().sampling!.cursor).toBeGreaterThan(paused);
  });

  it("stops with a native error when Jev fails, and editing comes back", async () => {
    vi.spyOn(api, "decide").mockRejectedValue(new ApiError(400, "bad_candidates", "Jev is down"));
    buildSampling(3);
    await playSampling();
    expect(useStudio.getState().sim).toMatchObject({ status: "error", error: "Jev is down" });
    expect(desk.state.interactive).toBe(true);
  });

  it("skips samples deleted mid-run, and rewinds on request", async () => {
    vi.spyOn(api, "decide").mockResolvedValue(decision());
    const ids = buildSampling(3);
    desk.deleteShapes([ids[0]]);
    void playSampling();
    await runUntil(() => useStudio.getState().sim.status === "done");
    expect(useStudio.getState().sampling?.cursor).toBe(3);
    await vi.advanceTimersByTimeAsync(3000);
    rewindSampling();
    expect(useStudio.getState().sampling).toMatchObject({ cursor: 0, phase: "ready" });
    stopSampling();
    expect(useStudio.getState().sampling).toBeNull();
    rewindSampling();
    await playSampling();
  });
});
