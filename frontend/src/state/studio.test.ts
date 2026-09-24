import { beforeEach, describe, expect, it } from "vitest";

import { MATERIALS, sketch } from "@/test/fixtures";

import { HISTORY_LIMIT, MAX_PINNED, historyStats, initialStudio, useStudio, type HistoryEntry } from "./studio";

const entry = (i: number, overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: `h${i}`,
  at: Date.now(),
  boardId: "b",
  regionId: null,
  boardTitle: "B",
  target: "t",
  materialId: "m",
  confidence: 0.5,
  certainty: "leaning",
  provider: "mock",
  ...overrides,
});

beforeEach(() => useStudio.setState(initialStudio));

describe("studio store", () => {
  it("indexes the catalogue", () => {
    useStudio.getState().setCatalog(MATERIALS, [sketch()]);
    expect(useStudio.getState().materialsById.get("ink-0")?.type).toBe("ink");
  });

  it("tracks transient board state", () => {
    const s = useStudio.getState();
    s.setBoardState("b", "analyzing");
    expect(useStudio.getState().boardState).toEqual({ b: "analyzing" });
    const before = useStudio.getState().boardState;
    s.setBoardState("b", "analyzing");
    expect(useStudio.getState().boardState).toBe(before);
    s.setBoardState("b", null);
    expect(useStudio.getState().boardState).toEqual({});
  });

  it("only patches the matching active decision", () => {
    const s = useStudio.getState();
    s.setActive({ key: "k", status: "analyzing" } as never);
    s.patchActive("other", { status: "error" });
    expect(useStudio.getState().active?.status).toBe("analyzing");
    s.patchActive("k", { status: "ready" });
    expect(useStudio.getState().active?.status).toBe("ready");
  });

  it("caps history and pins", () => {
    const s = useStudio.getState();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) s.pushHistory(entry(i));
    expect(useStudio.getState().history).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < MAX_PINNED + 2; i++) s.togglePin(`m${i}`);
    expect(useStudio.getState().pinned).toHaveLength(MAX_PINNED);
    s.togglePin(`m${MAX_PINNED + 1}`);
    expect(useStudio.getState().pinned).not.toContain(`m${MAX_PINNED + 1}`);
  });

  it("toggles drawers, chaos and settings", () => {
    const s = useStudio.getState();
    s.setDrawer("sketches");
    expect(useStudio.getState().drawer).toBe("sketches");
    s.setDrawer("sketches");
    expect(useStudio.getState().drawer).toBe("none");
    s.toggleChaos();
    expect(useStudio.getState()).toMatchObject({ chaos: true, candidateCount: 14 });
    s.toggleChaos();
    expect(useStudio.getState().candidateCount).toBe(10);
    s.setCandidateCount(40);
    expect(useStudio.getState().candidateCount).toBe(16);
    s.setSave("saved");
    expect(useStudio.getState().savedAt).not.toBeNull();
    s.setHover({ boardId: "a", regionId: "r" });
    const hover = useStudio.getState().hover;
    s.setHover({ boardId: "a", regionId: "r" });
    expect(useStudio.getState().hover).toBe(hover);
  });

  it("derives stats from Jev decisions only", () => {
    const now = new Date("2026-09-23T12:00:00").getTime();
    const stats = historyStats(
      [entry(1, { at: now, confidence: 0.8 }), entry(2, { at: now - 86_400_000 * 2, confidence: 0.4 }), entry(3, { provider: "manual", confidence: 1 })],
      now,
    );
    expect(stats).toEqual({ today: 1, total: 2, avgConfidence: expect.closeTo(0.6, 5) });
    expect(historyStats([], now).avgConfidence).toBeNull();
  });
});
