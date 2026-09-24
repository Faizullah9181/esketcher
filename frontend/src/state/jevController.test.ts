import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setLockedMaterial } from "@/lib/canvas/boards";
import type { Desk } from "@/lib/desk/desk";
import { ApiError, api } from "@/services/api";
import { boardOf, setupDesk } from "@/test/desk";
import { decision } from "@/test/fixtures";

import {
  applyActive,
  applyManual,
  cancelDecision,
  chaosTick,
  landFlight,
  passesThreshold,
  replay,
  requestDecision,
  resetControllerState,
  retryDecision,
  targetKey,
  waitForLanding,
} from "./jevController";
import { useStudio } from "./studio";

let BOARD: string;
let desk: Desk;

beforeEach(() => {
  vi.useFakeTimers();
  resetControllerState();
  ({ desk, ids: [BOARD] } = setupDesk());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const settle = () => vi.advanceTimersByTimeAsync(2000);

describe("requestDecision", () => {
  it("sends measured features and a candidate field, then shows the answer", async () => {
    const decide = vi.spyOn(api, "decide").mockResolvedValue(decision({ certainty: "uncertain", confidence: 0.2 }));
    const promise = requestDecision({ boardId: BOARD, regionId: "iris-0", autoApply: true });
    expect(useStudio.getState().active).toMatchObject({ status: "analyzing", key: targetKey(BOARD, "iris-0") });
    expect(useStudio.getState().boardState[BOARD]).toBe("analyzing");
    await settle();
    await promise;

    const body = decide.mock.calls[0][0];
    expect(body.scope).toBe("region");
    expect(body.target.kind).toBe("iris");
    expect(body.candidateMaterials).toHaveLength(10);
    expect(body.context.sketchId).toBe("sk-091");
    const state = useStudio.getState();
    expect(state.active).toMatchObject({ status: "ready" });
    expect(state.boardState[BOARD]).toBe("decision-ready");
    expect(state.history[0]).toMatchObject({ materialId: "liquid-0", target: "iris", provider: "real" });
    // uncertain + "leaning" threshold: Jev does not paint on its own
    expect(state.flights).toHaveLength(0);
  });

  it("paints automatically when Jev is sure enough", async () => {
    vi.spyOn(api, "decide").mockResolvedValue(decision());
    void requestDecision({ boardId: BOARD, regionId: "iris-0", autoApply: true });
    await settle();
    const flights = useStudio.getState().flights;
    expect(flights).toHaveLength(1);
    expect(flights[0]).toMatchObject({ materialId: "liquid-0", boardId: BOARD, assignments: { "iris-0": "liquid-0" }, decisionId: "d-1" });
    expect(useStudio.getState().boardState[BOARD]).toBe("painting");

    landFlight(flights[0].id);
    expect(boardOf(desk, BOARD).props.paints["iris-0"]).toMatchObject({ m: "liquid-0", d: "d-1" });
    expect(useStudio.getState().flights).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(useStudio.getState().boardState[BOARD]).toBeUndefined();
  });

  it("asks Jev for the board's palette once, then paints inside it", async () => {
    useStudio.setState({ palettes: [{ id: "ocean-ice", name: "Ocean & ice", families: ["ocean"], description: "cool" }] });
    const palette = vi.spyOn(api, "palette").mockResolvedValue({ decisionId: "p", palette: "ocean-ice", probabilities: {}, confidence: 0.7, certainty: "confident", latencyMs: 300, provider: "real", model: "jev" });
    const decide = vi.spyOn(api, "decide").mockResolvedValue(decision());
    void requestDecision({ boardId: BOARD, regionId: "iris-0", autoApply: false });
    await settle();
    expect(palette).toHaveBeenCalledTimes(1);
    expect(palette.mock.calls[0][0].target.kind).toBe("board");
    expect(decide.mock.calls[0][0].context.palette).toBe("ocean-ice");
    expect(boardOf(desk, BOARD).props.palette).toBe("ocean-ice");
    void requestDecision({ boardId: BOARD, regionId: "pupil-0", autoApply: false });
    await settle();
    expect(palette).toHaveBeenCalledTimes(1);
  });

  it("paints without a palette when the palette decision fails", async () => {
    useStudio.setState({ palettes: [{ id: "ocean-ice", name: "Ocean & ice", families: ["ocean"], description: "cool" }] });
    vi.spyOn(api, "palette").mockRejectedValue(new ApiError(503, "jev_unavailable", "down"));
    const decide = vi.spyOn(api, "decide").mockResolvedValue(decision());
    void requestDecision({ boardId: BOARD, regionId: "iris-0", autoApply: false });
    await settle();
    expect(decide.mock.calls[0][0].context.palette).toBeNull();
    expect(useStudio.getState().active?.status).toBe("ready");
  });

  it("reuses a cached decision for an identical question", async () => {
    const decide = vi.spyOn(api, "decide").mockResolvedValue(decision());
    void requestDecision({ boardId: BOARD, regionId: "iris-0", autoApply: false });
    await settle();
    void requestDecision({ boardId: BOARD, regionId: "iris-0", autoApply: false });
    await settle();
    expect(decide).toHaveBeenCalledTimes(1);
    expect(useStudio.getState().history).toHaveLength(1);
  });

  it("decides whole sketches with a treatment", async () => {
    const decide = vi.spyOn(api, "decide").mockResolvedValue(decision({ treatment: { mode: "duotone", probabilities: {}, confidence: 0.7 } }));
    void requestDecision({ boardId: BOARD, regionId: null, autoApply: false });
    await settle();
    expect(decide.mock.calls[0][0].scope).toBe("sketch");
    applyActive();
    const assignments = useStudio.getState().flights[0].assignments;
    expect(new Set(Object.values(assignments))).toEqual(new Set(["liquid-0", "chrome-0"]));
  });

  it("applies an override from the field to every region", async () => {
    vi.spyOn(api, "decide").mockResolvedValue(decision());
    void requestDecision({ boardId: BOARD, regionId: null, autoApply: false });
    await settle();
    applyActive("ink-0");
    expect(new Set(Object.values(useStudio.getState().flights[0].assignments))).toEqual(new Set(["ink-0"]));
  });

  it("surfaces backend errors natively and never blocks the board", async () => {
    vi.spyOn(api, "decide").mockRejectedValue(new ApiError(503, "jev_unavailable", "down"));
    void requestDecision({ boardId: BOARD, regionId: "iris-0", autoApply: true });
    await settle();
    expect(useStudio.getState().active).toMatchObject({ status: "error", error: { code: "jev_unavailable" } });
    expect(useStudio.getState().boardState[BOARD]).toBeUndefined();
  });

  it("maps unknown failures", async () => {
    vi.spyOn(api, "decide").mockRejectedValue(new Error("boom"));
    void requestDecision({ boardId: BOARD, regionId: "iris-0", autoApply: false });
    await settle();
    expect(useStudio.getState().active?.error?.code).toBe("unknown");
  });

  it("aborts the previous question when a new one starts", async () => {
    vi.spyOn(api, "decide").mockImplementation(
      (_body, signal) => new Promise((resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("stop", "AbortError")));
        setTimeout(() => resolve(decision()), 100);
      }),
    );
    void requestDecision({ boardId: BOARD, regionId: "iris-0", autoApply: false });
    void requestDecision({ boardId: BOARD, regionId: "pupil-0", autoApply: false });
    await settle();
    expect(useStudio.getState().active?.regionId).toBe("pupil-0");
    expect(useStudio.getState().history).toHaveLength(1);
  });

  it("retries without the rejected winner", async () => {
    vi.spyOn(api, "decide").mockResolvedValue(decision());
    const retry = vi.spyOn(api, "retry").mockResolvedValue(decision({ selectedMaterial: "chrome-0", decisionId: "d-2" }));
    void requestDecision({ boardId: BOARD, regionId: "iris-0", autoApply: false });
    await settle();
    retryDecision();
    await settle();
    expect(retry.mock.calls[0][0]).toMatchObject({ rejectedMaterialIds: ["liquid-0"], attempt: 2 });
    expect(retry.mock.calls[0][0].candidateMaterials).not.toContain("liquid-0");
    expect(useStudio.getState().active?.decision?.selectedMaterial).toBe("chrome-0");
  });

  it("uses the locked material instead of asking Jev", async () => {
    setLockedMaterial(desk, BOARD, "lava-0");
    const decide = vi.spyOn(api, "decide");
    await requestDecision({ boardId: BOARD, regionId: "iris-0", autoApply: true });
    expect(decide).not.toHaveBeenCalled();
    expect(useStudio.getState().flights[0].materialId).toBe("lava-0");
    await requestDecision({ boardId: BOARD, regionId: "iris-0", autoApply: false });
    expect(useStudio.getState().flights).toHaveLength(1);
  });

  it("ignores locked or missing boards", async () => {
    desk.toggleLock([BOARD]);
    const decide = vi.spyOn(api, "decide");
    await requestDecision({ boardId: BOARD, regionId: null, autoApply: true });
    await requestDecision({ boardId: "shape:none", regionId: null, autoApply: true });
    expect(decide).not.toHaveBeenCalled();
  });

  it("runs chaos decisions in the background without taking the panel", async () => {
    const decide = vi.spyOn(api, "decide").mockResolvedValue(decision());
    chaosTick(Object.assign(() => 0, { pick: <T,>(items: readonly T[]) => items[0] }) as never);
    void requestDecision({ boardId: BOARD, regionId: "eye-0", autoApply: true, background: true }); // busy: skipped
    await settle();
    expect(decide).toHaveBeenCalledTimes(1);
    expect(useStudio.getState().active).toBeNull();
    expect(useStudio.getState().flights).toHaveLength(1);
  });
});

describe("manual paths", () => {
  it("arms the material when there is no target", () => {
    expect(applyManual("ink-0")).toBe(false);
    expect(useStudio.getState().armedMaterial).toBe("ink-0");
  });

  it("paints the focused region and records a manual entry", () => {
    useStudio.getState().setFocus({ boardId: BOARD, regionId: "iris-0" });
    const from = { left: 10, top: 10, width: 20, height: 20 } as DOMRect;
    expect(applyManual("ink-0", null, from)).toBe(true);
    const state = useStudio.getState();
    expect(state.flights[0]).toMatchObject({ from: { x: 20, y: 20 }, assignments: { "iris-0": "ink-0" } });
    expect(state.history[0]).toMatchObject({ provider: "manual", target: "iris" });
  });

  it("floods the board when no region is targeted", () => {
    applyManual("ink-0", { boardId: BOARD, regionId: null });
    expect(Object.keys(useStudio.getState().flights[0].assignments).length).toBeGreaterThan(3);
    expect(useStudio.getState().history[0].target).toBe("whole sketch");
  });

  it("replays a history entry", async () => {
    replay({ id: "d-1", at: 0, boardId: BOARD, regionId: "iris-0", boardTitle: "W", target: "iris", materialId: "chrome-0", confidence: 0.7, certainty: "confident", provider: "real" });
    expect(desk.state.selection).toEqual([BOARD]);
    expect(useStudio.getState().focus).toEqual({ boardId: BOARD, regionId: "iris-0" });
    await vi.advanceTimersByTimeAsync(800);
    expect(useStudio.getState().flights[0]).toMatchObject({ materialId: "chrome-0", decisionId: "d-1" });
  });

  it("replays whole-sketch and manual entries", async () => {
    replay({ id: "m", at: 0, boardId: BOARD, regionId: null, boardTitle: "W", target: "whole sketch", materialId: "ink-0", confidence: 1, certainty: "confident", provider: "manual" });
    await vi.advanceTimersByTimeAsync(800);
    expect(useStudio.getState().flights[0].decisionId).toBeUndefined();
    replay({ id: "x", at: 0, boardId: "shape:gone", regionId: null, boardTitle: "", target: "", materialId: "", confidence: 0, certainty: "uncertain", provider: "real" });
  });

  it("cancels the active decision", () => {
    useStudio.getState().setActive({ key: "k", boardId: BOARD } as never);
    useStudio.getState().setBoardState(BOARD, "analyzing");
    cancelDecision();
    expect(useStudio.getState().active).toBeNull();
    expect(useStudio.getState().boardState[BOARD]).toBeUndefined();
    retryDecision();
    applyActive();
  });

  it("orders certainty bands", () => {
    expect(passesThreshold("confident", "leaning")).toBe(true);
    expect(passesThreshold("uncertain", "leaning")).toBe(false);
    expect(passesThreshold("uncertain", "uncertain")).toBe(true);
  });

  it("does nothing when landing an unknown flight", () => {
    landFlight("missing");
    expect(boardOf(desk, BOARD).props.paints).toEqual({});
  });

  it("forces uncertain answers and paints every region of a kind", async () => {
    vi.spyOn(api, "decide").mockResolvedValue(decision({ certainty: "uncertain", confidence: 0.1 }));
    const promise = requestDecision({ boardId: BOARD, regionId: "iris-0", autoApply: true, force: true, applyTo: ["pupil-0"] });
    await settle();
    const outcome = await promise;
    expect(outcome?.flightId).toBeDefined();
    expect(useStudio.getState().flights[0].assignments).toEqual({ "iris-0": "liquid-0", "pupil-0": "liquid-0" });
    const landed = waitForLanding(outcome!.flightId!);
    landFlight(outcome!.flightId!);
    await landed;
    expect(boardOf(desk, BOARD).props.paints["pupil-0"].m).toBe("liquid-0");
  });

  it("gets the panel out of the way on narrow screens when paint flies", () => {
    const original = window.matchMedia;
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    try {
      useStudio.getState().setPanelOpen(true);
      applyManual("ink-0", { boardId: BOARD, regionId: "iris-0" });
      expect(useStudio.getState().panelOpen).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });

  it("lands stalled flights after a timeout", async () => {
    applyManual("ink-0", { boardId: BOARD, regionId: "iris-0" });
    const id = useStudio.getState().flights[0].id;
    const landed = waitForLanding(id, 1000);
    await vi.advanceTimersByTimeAsync(1100);
    await landed;
    expect(boardOf(desk, BOARD).props.paints["iris-0"].m).toBe("ink-0");
    await waitForLanding("gone");
  });
});
