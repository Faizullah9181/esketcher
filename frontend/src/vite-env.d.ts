/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** "1": static build with no backend (bundled catalog, local saves, Jev off) */
  readonly VITE_OFFLINE?: string;
}
