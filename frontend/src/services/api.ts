import type {
  Decision,
  DecisionRequest,
  Health,
  Material,
  PaletteDecision,
  PaletteDirection,
  Project,
  RetryRequest,
  SketchAsset,
} from "@/types";

const BASE_URL = import.meta.env.PROD && import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL : "";

/** Error with the backend's machine-readable `detail.code` preserved. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly detail: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    // a content type only where there is content: on a cross-origin GET it would
    // force a CORS preflight, doubling the round trips for every catalog request
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: init.body ? { "Content-Type": "application/json", ...init.headers } : init.headers,
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError(0, "network", "The studio backend is unreachable");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: unknown };
    const detail =
      body.detail && typeof body.detail === "object" && !Array.isArray(body.detail)
        ? (body.detail as Record<string, unknown>)
        : {};
    const code = typeof detail.code === "string" ? detail.code : response.status === 422 ? "invalid" : "http";
    const message = typeof detail.message === "string" ? detail.message : `Request failed (${response.status})`;
    throw new ApiError(response.status, code, message, detail);
  }
  // a static host answering /api with its HTML fallback has no backend behind it
  return (await response.json().catch(() => {
    throw new ApiError(0, "network", "The studio backend is unreachable");
  })) as T;
}

const post = <T>(path: string, body: unknown, signal?: AbortSignal) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body), signal });

const onlineApi = {
  health: (signal?: AbortSignal) => request<Health>("/api/health", { signal }),
  materials: (signal?: AbortSignal) => request<Material[]>("/api/materials", { signal }),
  sketches: (signal?: AbortSignal) => request<SketchAsset[]>("/api/sketches", { signal }),
  palettes: (signal?: AbortSignal) => request<PaletteDirection[]>("/api/materials/palettes", { signal }),
  palette: (body: Pick<DecisionRequest, "target" | "context">, signal?: AbortSignal) => post<PaletteDecision>("/api/jev/palette", body, signal),
  decide: (body: DecisionRequest, signal?: AbortSignal) => post<Decision>("/api/jev/decide", body, signal),
  retry: (body: RetryRequest, signal?: AbortSignal) => post<Decision>("/api/jev/retry", body, signal),
  createProject: (name: string, snapshot: Record<string, unknown>) =>
    post<Project>("/api/projects", { name, snapshot }),
  getProject: (id: string) => request<Project>(`/api/projects/${encodeURIComponent(id)}`),
  saveProject: (id: string, snapshot: Record<string, unknown>, revision: number) =>
    request<Project>(`/api/projects/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ snapshot, revision }),
    }),
};

export type Api = typeof onlineApi;

/**
 * Offline mode: no network calls. The catalog is the bundled snapshot, the
 * project lives in localStorage, and every Jev call fails with code `offline`;
 * Jev answers are never invented. `useCatalog` switches to it at boot when the
 * server can't be reached; `VITE_OFFLINE=1` forces it for a whole build.
 */
export const FORCED_OFFLINE = import.meta.env.VITE_OFFLINE === "1" || import.meta.env.VITE_OFFLINE === "true";

export const OFFLINE_MESSAGE = "The eSketcher server isn't reachable, so Jev is off. Everything else works; reload to reconnect.";
export const OFFLINE_PROJECT_KEY = "esketcher:offline-project";

export function createOfflineApi(storage: Pick<Storage, "getItem" | "setItem"> | null = safeStorage()): Api {
  const offline = () => Promise.reject(new ApiError(0, "offline", OFFLINE_MESSAGE));
  const catalog = () => import("@/data/catalog.json").then((m) => m.default as unknown as { materials: Material[]; sketches: SketchAsset[]; palettes: PaletteDirection[] });
  let memory: Project | null = null;
  const read = (): Project | null => {
    try {
      const raw = storage?.getItem(OFFLINE_PROJECT_KEY);
      return raw ? (JSON.parse(raw) as Project) : memory;
    } catch {
      return memory;
    }
  };
  const write = (project: Project): Project => {
    memory = project;
    try {
      storage?.setItem(OFFLINE_PROJECT_KEY, JSON.stringify(project));
    } catch {
      /* full or blocked storage: the desk still works for this visit */
    }
    return project;
  };
  return {
    health: offline,
    materials: () => catalog().then((c) => c.materials),
    sketches: () => catalog().then((c) => c.sketches),
    palettes: () => catalog().then((c) => c.palettes),
    palette: offline,
    decide: offline,
    retry: offline,
    createProject: async (name, snapshot) => {
      const now = new Date().toISOString();
      return write({ id: "local", name, snapshot, revision: 1, createdAt: now, updatedAt: now });
    },
    getProject: async (id) => {
      const project = read();
      if (!project || project.id !== id) throw new ApiError(404, "not_found", "No saved desk in this browser");
      return project;
    },
    saveProject: async (id, snapshot, revision) => {
      const project = read();
      if (!project || project.id !== id) throw new ApiError(404, "not_found", "No saved desk in this browser");
      return write({ ...project, snapshot, revision: revision + 1, updatedAt: new Date().toISOString() });
    },
  };
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

let current: Api = FORCED_OFFLINE ? createOfflineApi() : onlineApi;

/** Every call goes to the current mode; methods stay own properties so tests can spy on them. */
export const api = Object.fromEntries(
  (Object.keys(onlineApi) as (keyof Api)[]).map((key) => [key, (...args: never[]) => (current[key] as (...a: never[]) => unknown)(...args)]),
) as Api;

export const isOffline = (): boolean => current !== onlineApi;

/** Switch this visit to offline mode (once, at boot). Returns the offline adapter. */
export function goOffline(): Api {
  if (current === onlineApi) current = createOfflineApi();
  return current;
}

/** Test hook: back to the build's starting mode. */
export function resetApiMode(): void {
  current = FORCED_OFFLINE ? createOfflineApi() : onlineApi;
}
