import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, OFFLINE_MESSAGE, OFFLINE_PROJECT_KEY, api, createOfflineApi, goOffline, isAbort, isOffline, resetApiMode } from "./api";

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}), ...response });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetApiMode();
});

describe("api", () => {
  it("calls every endpoint with the right method and path", async () => {
    const fetch = mockFetch({ json: async () => ({ ok: 1 }) });
    await api.health();
    await api.materials();
    await api.sketches();
    await api.palettes();
    await api.palette({} as never);
    await api.decide({} as never);
    await api.retry({} as never);
    await api.createProject("n", {});
    await api.getProject("a b");
    await api.saveProject("id", { a: 1 }, 3);
    const calls = fetch.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${url}`);
    expect(calls).toEqual([
      "GET /api/health",
      "GET /api/materials",
      "GET /api/sketches",
      "GET /api/materials/palettes",
      "POST /api/jev/palette",
      "POST /api/jev/decide",
      "POST /api/jev/retry",
      "POST /api/projects",
      "GET /api/projects/a%20b",
      "PUT /api/projects/id",
    ]);
    expect(JSON.parse(fetch.mock.calls[9][1].body)).toEqual({ snapshot: { a: 1 }, revision: 3 });
  });

  it("keeps the backend's error code", async () => {
    mockFetch({ ok: false, status: 503, json: async () => ({ detail: { code: "jev_unavailable", message: "down", extra: 1 } }) });
    const error = await api.health().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, code: "jev_unavailable", message: "down", detail: { extra: 1 } });
  });

  it("falls back for validation errors and unreadable bodies", async () => {
    mockFetch({ ok: false, status: 422, json: async () => ({ detail: [{ msg: "bad" }] }) });
    expect(await api.health().catch((e) => e.code)).toBe("invalid");
    mockFetch({ ok: false, status: 500, json: async () => Promise.reject(new Error("html")) });
    const error = await api.health().catch((e) => e);
    expect(error.code).toBe("http");
    expect(error.message).toContain("500");
  });

  it("maps network failures and passes aborts through", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));
    expect(await api.health().catch((e) => e.code)).toBe("network");
    const abort = new DOMException("stop", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
    expect(await api.health().catch((e) => e)).toBe(abort);
    expect(isAbort(abort)).toBe(true);
    expect(isAbort(new Error("x"))).toBe(false);
  });
});

describe("offline api", () => {
  const memoryStorage = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  };

  it("serves the bundled catalog and never touches the network", async () => {
    const fetch = mockFetch({});
    const offline = createOfflineApi(memoryStorage());
    const [materials, sketches, palettes] = await Promise.all([offline.materials(), offline.sketches(), offline.palettes()]);
    expect(materials).toHaveLength(121);
    expect(sketches).toHaveLength(105);
    expect(palettes).toHaveLength(7);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses every Jev call with the offline code instead of inventing an answer", async () => {
    const offline = createOfflineApi(memoryStorage());
    for (const call of [offline.health(), offline.palette({} as never), offline.decide({} as never), offline.retry({} as never)]) {
      await expect(call).rejects.toMatchObject({ status: 0, code: "offline", message: OFFLINE_MESSAGE });
    }
  });

  it("keeps the project in storage across visits", async () => {
    const storage = memoryStorage();
    const first = createOfflineApi(storage);
    await expect(first.getProject("local")).rejects.toMatchObject({ status: 404 });
    const created = await first.createProject("My universe", { desk: 1 });
    const saved = await first.saveProject(created.id, { desk: 2 }, created.revision);
    expect(saved.revision).toBe(2);

    const second = createOfflineApi(storage);
    expect((await second.getProject("local")).snapshot).toEqual({ desk: 2 });
    await expect(second.saveProject("other", {}, 1)).rejects.toBeInstanceOf(ApiError);
    expect(JSON.parse(storage.getItem(OFFLINE_PROJECT_KEY)!).revision).toBe(2);
  });

  it("still works for the visit when storage is blocked", async () => {
    const offline = createOfflineApi({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    const created = await offline.createProject("n", { a: 1 });
    expect((await offline.getProject(created.id)).snapshot).toEqual({ a: 1 });
    const noStorage = createOfflineApi(null);
    await noStorage.createProject("n", {});
    expect((await noStorage.saveProject("local", { b: 1 }, 1)).revision).toBe(2);
  });
});

describe("api mode", () => {
  it("treats an HTML fallback page as no backend", async () => {
    mockFetch({ json: async () => JSON.parse("<!doctype html>") });
    await expect(api.materials()).rejects.toMatchObject({ status: 0, code: "network" });
  });

  it("switches every call to the offline adapter, once", async () => {
    const fetch = mockFetch({ json: async () => [] });
    expect(isOffline()).toBe(false);
    const offline = goOffline();
    expect(goOffline()).toBe(offline);
    expect(isOffline()).toBe(true);
    expect(await api.materials()).toHaveLength(121);
    await expect(api.decide({} as never)).rejects.toMatchObject({ code: "offline" });
    expect(fetch).not.toHaveBeenCalled();
    resetApiMode();
    expect(isOffline()).toBe(false);
  });
});
