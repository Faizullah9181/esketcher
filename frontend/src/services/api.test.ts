import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, isAbort } from "./api";

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}), ...response });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

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
