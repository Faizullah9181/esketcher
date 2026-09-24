import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Desk, newId } from "@/lib/desk/desk";
import type { FrameShape } from "@/lib/desk/types";
import { ApiError, api } from "@/services/api";
import { initialStudio, useStudio } from "@/state/studio";

import { useProjectSync } from "./useProjectSync";

vi.mock("@/lib/canvas/boards", () => ({ seedDesk: vi.fn(), zoomToStart: vi.fn() }));
const boards = await import("@/lib/canvas/boards");

const project = (overrides = {}) => ({ id: "p1", name: "n", snapshot: {}, revision: 0, createdAt: "", updatedAt: "", ...overrides });
const frame = (desk: Desk) => desk.createShape<FrameShape>({ id: newId("frame"), type: "frame", x: 0, y: 0, w: 10, h: 10, title: "F" });

beforeEach(() => {
  vi.clearAllMocks();
  useStudio.setState(initialStudio);
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("useProjectSync", () => {
  it("seeds and creates a project on first run", async () => {
    const create = vi.spyOn(api, "createProject").mockResolvedValue(project());
    renderHook(() => useProjectSync(new Desk()));
    await waitFor(() => expect(useStudio.getState().save).toBe("saved"));
    expect(boards.seedDesk).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith("My universe", { desk: { version: 1, shapes: {} } });
    expect(localStorage.getItem("esketcher:project")).toBe("p1");
  });

  it("loads an existing desk and its history", async () => {
    localStorage.setItem("esketcher:project", "p1");
    localStorage.setItem("esketcher:history:p1", JSON.stringify([{ id: "h" }]));
    const saved = new Desk();
    frame(saved);
    vi.spyOn(api, "getProject").mockResolvedValue(project({ snapshot: { desk: saved.snapshot() }, revision: 4 }));
    const desk = new Desk();
    renderHook(() => useProjectSync(desk));
    await waitFor(() => expect(useStudio.getState().save).toBe("saved"));
    expect(desk.getShapes()).toHaveLength(1);
    expect(desk.canUndo()).toBe(false);
    expect(useStudio.getState().history).toHaveLength(1);
  });

  it("starts fresh over snapshots from the old canvas", async () => {
    localStorage.setItem("esketcher:project", "p1");
    vi.spyOn(api, "getProject").mockResolvedValue(project({ snapshot: { document: { store: {} } } }));
    renderHook(() => useProjectSync(new Desk()));
    await waitFor(() => expect(useStudio.getState().save).toBe("saved"));
    expect(boards.seedDesk).toHaveBeenCalled();
  });

  it("recreates a project the backend forgot", async () => {
    localStorage.setItem("esketcher:project", "gone");
    vi.spyOn(api, "getProject").mockRejectedValue(new ApiError(404, "not_found", "no"));
    vi.spyOn(api, "createProject").mockResolvedValue(project({ id: "p2" }));
    renderHook(() => useProjectSync(new Desk()));
    await waitFor(() => expect(useStudio.getState().projectId).toBe("p2"));
  });

  it("works offline when the backend is down", async () => {
    localStorage.setItem("esketcher:project", "p1");
    vi.spyOn(api, "getProject").mockRejectedValue(new ApiError(0, "network", "down"));
    renderHook(() => useProjectSync(new Desk()));
    await waitFor(() => expect(useStudio.getState().save).toBe("offline"));
    expect(boards.seedDesk).toHaveBeenCalled();
  });

  it("autosaves after edits, retrying once on a revision conflict", async () => {
    vi.spyOn(api, "createProject").mockResolvedValue(project());
    const save = vi
      .spyOn(api, "saveProject")
      .mockRejectedValueOnce(new ApiError(409, "conflict", "stale", { revision: 3 }))
      .mockResolvedValue(project({ revision: 4 }));
    const desk = new Desk();
    renderHook(() => useProjectSync(desk));
    await waitFor(() => expect(useStudio.getState().projectId).toBe("p1"));
    frame(desk);
    expect(useStudio.getState().save).toBe("dirty");
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2), { timeout: 4000 });
    expect(save.mock.calls[1][2]).toBe(3);
    expect(save.mock.calls[1][1]).toMatchObject({ desk: { version: 1 } });
    await waitFor(() => expect(useStudio.getState().save).toBe("saved"));
  });

  it("marks failed saves and keeps history locally", async () => {
    vi.spyOn(api, "createProject").mockResolvedValue(project());
    vi.spyOn(api, "saveProject").mockRejectedValue(new ApiError(0, "network", "down"));
    const desk = new Desk();
    renderHook(() => useProjectSync(desk));
    await waitFor(() => expect(useStudio.getState().projectId).toBe("p1"));
    frame(desk);
    await waitFor(() => expect(useStudio.getState().save).toBe("offline"), { timeout: 4000 });
    useStudio.getState().pushHistory({ id: "h", at: 1, boardId: "b", regionId: null, boardTitle: "", target: "", materialId: "m", confidence: 1, certainty: "confident", provider: "manual" });
    expect(localStorage.getItem("esketcher:history:p1")).toContain('"h"');
  });

  it("does nothing without a desk", () => {
    renderHook(() => useProjectSync(null));
    expect(useStudio.getState().save).toBe("loading");
  });
});

describe("strict-mode double effects", () => {
  it("loads each desk once", async () => {
    const create = vi.spyOn(api, "createProject").mockResolvedValue(project());
    const desk = new Desk();
    const first = renderHook(() => useProjectSync(desk));
    first.unmount();
    renderHook(() => useProjectSync(desk));
    await waitFor(() => expect(useStudio.getState().save).toBe("saved"));
    expect(create).toHaveBeenCalledTimes(1);
    expect(boards.seedDesk).toHaveBeenCalledTimes(1);
  });
});

describe("leaving the studio", () => {
  it("saves pending edits immediately on unmount", async () => {
    vi.spyOn(api, "createProject").mockResolvedValue(project());
    const save = vi.spyOn(api, "saveProject").mockResolvedValue(project({ revision: 1 }));
    const desk = new Desk();
    const hook = renderHook(() => useProjectSync(desk));
    await waitFor(() => expect(useStudio.getState().projectId).toBe("p1"));
    frame(desk);
    hook.unmount();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  });
});
