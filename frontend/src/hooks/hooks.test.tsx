import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, goOffline, isOffline, resetApiMode } from "@/services/api";
import { initialStudio, useStudio } from "@/state/studio";
import { MATERIALS, decision, sketch } from "@/test/fixtures";

import { useCatalog } from "./useCatalog";
import { useChaos } from "./useChaos";
import { useJevDecision } from "./useJevDecision";
import { useJevHealth } from "./useJevHealth";
import { useMaterial, useMaterials } from "./useMaterials";
import { filterSketches, useFilteredSketches, useSketches } from "./useSketches";

vi.mock("@/state/jevController", () => ({
  chaosTick: vi.fn(),
  requestDecision: vi.fn(),
  retryDecision: vi.fn(),
  applyActive: vi.fn(),
  cancelDecision: vi.fn(),
}));

const controller = await import("@/state/jevController");

beforeEach(() => {
  resetApiMode();
  useStudio.setState(initialStudio);
});
afterEach(() => vi.restoreAllMocks());

describe("useCatalog", () => {
  it("loads the libraries into the store", async () => {
    vi.spyOn(api, "materials").mockResolvedValue(MATERIALS);
    vi.spyOn(api, "sketches").mockResolvedValue([sketch()]);
    vi.spyOn(api, "palettes").mockResolvedValue([{ id: "p", name: "P", families: [], description: "" }]);
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current[0].status).toBe("ready"));
    expect(useStudio.getState().materials).toHaveLength(MATERIALS.length);
    expect(useStudio.getState().palettes).toHaveLength(1);
  });

  it("loads without palettes on an older backend", async () => {
    vi.spyOn(api, "materials").mockResolvedValue(MATERIALS);
    vi.spyOn(api, "sketches").mockResolvedValue([]);
    vi.spyOn(api, "palettes").mockRejectedValue(new ApiError(404, "not_found", "no"));
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current[0].status).toBe("ready"));
    expect(useStudio.getState().palettes).toEqual([]);
  });

  it("falls back to the bundled catalog when the server is down", async () => {
    vi.spyOn(api, "materials").mockRejectedValue(new ApiError(0, "network", "down"));
    vi.spyOn(api, "sketches").mockResolvedValue([]);
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current[0].status).toBe("ready"));
    expect(useStudio.getState().offline).toBe(true);
    expect(useStudio.getState().materials).toHaveLength(121);
    expect(useStudio.getState().sketches).toHaveLength(105);
    expect(isOffline()).toBe(true);
  });

  it("treats a server that never answers as down", async () => {
    vi.spyOn(api, "materials").mockImplementation((signal) => new Promise((_, reject) => signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
    vi.spyOn(api, "sketches").mockResolvedValue([]);
    const { result } = renderHook(() => useCatalog(true, 20));
    await waitFor(() => expect(result.current[0].status).toBe("ready"));
    expect(useStudio.getState().offline).toBe(true);
  });

  it("stays online when the server answers", async () => {
    vi.spyOn(api, "materials").mockResolvedValue(MATERIALS);
    vi.spyOn(api, "sketches").mockResolvedValue([]);
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current[0].status).toBe("ready"));
    expect(useStudio.getState().offline).toBe(false);
    expect(isOffline()).toBe(false);
  });

  it("reports errors and retries once already offline", async () => {
    goOffline();
    const materials = vi.spyOn(api, "materials").mockRejectedValueOnce(new ApiError(0, "network", "down")).mockResolvedValue(MATERIALS);
    vi.spyOn(api, "sketches").mockResolvedValue([]);
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current[0]).toEqual({ status: "error", message: "down" }));
    act(() => result.current[1]());
    await waitFor(() => expect(result.current[0].status).toBe("ready"));
    expect(materials).toHaveBeenCalledTimes(2);
  });

  it("asks nothing while disabled, and keeps a loaded catalog across pages", async () => {
    const materials = vi.spyOn(api, "materials").mockResolvedValue(MATERIALS);
    vi.spyOn(api, "sketches").mockResolvedValue([]);
    const { result, rerender } = renderHook(({ enabled }) => useCatalog(enabled), { initialProps: { enabled: false } });
    expect(materials).not.toHaveBeenCalled();
    expect(result.current[0].status).toBe("loading");
    rerender({ enabled: true });
    await waitFor(() => expect(result.current[0].status).toBe("ready"));
    rerender({ enabled: false });
    rerender({ enabled: true });
    expect(result.current[0].status).toBe("ready");
    expect(materials).toHaveBeenCalledTimes(1);
  });

  it("uses a generic message for unknown failures", async () => {
    goOffline();
    vi.spyOn(api, "materials").mockRejectedValue(new Error("x"));
    vi.spyOn(api, "sketches").mockResolvedValue([]);
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current[0]).toEqual({ status: "error", message: "Could not load the studio" }));
  });
});

describe("useJevHealth", () => {
  it("stores health, or the failure code", async () => {
    vi.spyOn(api, "health").mockResolvedValueOnce({ status: "ok", version: "1", jev: { mode: "real", model: "jev-latest", online: true, latencyMs: 300, availableModels: [], error: null } });
    const { unmount } = renderHook(() => useJevHealth());
    await waitFor(() => expect(useStudio.getState().health?.jev.mode).toBe("real"));
    unmount();
    vi.spyOn(api, "health").mockRejectedValueOnce(new ApiError(0, "network", "down"));
    renderHook(() => useJevHealth());
    await waitFor(() => expect(useStudio.getState().healthError).toBe("network"));
    vi.spyOn(api, "health").mockRejectedValueOnce(new Error("?"));
    renderHook(() => useJevHealth());
    await waitFor(() => expect(useStudio.getState().health).toBeNull());
  });

  it("asks nothing while disabled", () => {
    const health = vi.spyOn(api, "health");
    renderHook(() => useJevHealth(false));
    expect(health).not.toHaveBeenCalled();
  });

  it("stops asking once the visit is offline", async () => {
    const health = vi.spyOn(api, "health");
    useStudio.getState().setOffline(true);
    renderHook(() => useJevHealth());
    await waitFor(() => expect(useStudio.getState().healthError).toBe("offline"));
    expect(health).not.toHaveBeenCalled();
  });
});

describe("useChaos", () => {
  it("ticks only while chaos mode is on", () => {
    vi.useFakeTimers();
    renderHook(() => useChaos());
    vi.advanceTimersByTime(10_000);
    expect(controller.chaosTick).not.toHaveBeenCalled();
    act(() => useStudio.getState().toggleChaos());
    vi.advanceTimersByTime(9_000);
    expect(controller.chaosTick).toHaveBeenCalledTimes(2);
    act(() => useStudio.getState().setOffline(true));
    vi.advanceTimersByTime(9_000);
    expect(controller.chaosTick).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe("useJevDecision", () => {
  it("exposes the active decision only for the focused target", () => {
    const active = { key: "b|*", boardId: "b", regionId: null, status: "ready", decision: decision() };
    useStudio.setState({ active: active as never, focus: { boardId: "b", regionId: null } });
    const { result, rerender } = renderHook(() => useJevDecision());
    expect(result.current.active).toBe(active);
    result.current.decide();
    result.current.decideAndPaint();
    expect(controller.requestDecision).toHaveBeenCalledWith({ boardId: "b", regionId: null, autoApply: true });
    act(() => useStudio.setState({ focus: { boardId: "other", regionId: null } }));
    rerender();
    expect(result.current.active).toBeNull();
  });
});

describe("catalog hooks", () => {
  it("reads materials and filters sketches", () => {
    useStudio.getState().setCatalog(MATERIALS, [sketch(), sketch({ id: "sk-002", title: "Koi", category: "animals", tags: ["fish", "water"] })]);
    expect(renderHook(() => useMaterials()).result.current).toHaveLength(MATERIALS.length);
    expect(renderHook(() => useMaterial("ink-0")).result.current?.type).toBe("ink");
    expect(renderHook(() => useMaterial(null)).result.current).toBeUndefined();
    expect(renderHook(() => useSketches()).result.current).toHaveLength(2);
    expect(renderHook(() => useFilteredSketches("animals", "")).result.current.map((s) => s.title)).toEqual(["Koi"]);
    const all = useStudio.getState().sketches;
    expect(filterSketches(all, "all", "water").map((s) => s.id)).toEqual(["sk-002"]);
    expect(filterSketches(all, "all", "watch")).toHaveLength(1);
    expect(filterSketches(all, "all", "  ")).toHaveLength(2);
  });
});
