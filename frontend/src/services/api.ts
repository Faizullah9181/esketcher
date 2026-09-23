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
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
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
  return (await response.json()) as T;
}

const post = <T>(path: string, body: unknown, signal?: AbortSignal) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body), signal });

export const api = {
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
