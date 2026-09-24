/// <reference types="vitest/config" />
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from "vite";

/**
 * Head tags the app needs before any script runs:
 * - preconnect to the API when it lives on another origin, and preload the three
 *   catalog requests the app makes first thing, at low priority behind the bundle;
 * - on `/studio`, preload the lazy studio chunk and the shared chunks it imports, so they download beside the main
 *   bundle instead of after it (its hashed name is only known at build time).
 */
function earlyHints(apiUrl: string | undefined): Plugin {
  return {
    name: "esketcher:early-hints",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const tags: HtmlTagDescriptor[] = [];
        if (apiUrl) {
          try {
            const origin = new URL(apiUrl).origin;
            tags.push(
              { tag: "link", attrs: { rel: "preconnect", href: origin, crossorigin: "" }, injectTo: "head-prepend" },
              { tag: "link", attrs: { rel: "dns-prefetch", href: origin }, injectTo: "head-prepend" },
              ...["/api/materials", "/api/sketches", "/api/materials/palettes"].map(
                (p): HtmlTagDescriptor => ({ tag: "link", attrs: { rel: "preload", as: "fetch", crossorigin: "", fetchpriority: "low", href: `${origin}${p}` }, injectTo: "head" }),
              ),
            );
          } catch {
            /* not a URL: nothing to preconnect to */
          }
        }
        const studio = Object.values(ctx.bundle ?? {}).find((c) => c.type === "chunk" && c.facadeModuleId?.endsWith("/components/Studio.tsx"));
        if (studio?.type === "chunk") {
          // the chunk and the shared chunks it imports, so none of them waits for the main bundle to run
          const files = JSON.stringify([studio.fileName, ...studio.imports].map((f) => `/${f}`));
          tags.push({
            tag: "script",
            children: `if(location.pathname.replace(/\\/+$/,"")==="/studio")${files}.forEach(function(h){var l=document.createElement("link");l.rel="modulepreload";l.crossOrigin="";l.href=h;document.head.appendChild(l)})`,
            injectTo: "head",
          });
        }
        return tags;
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), earlyHints(mode === "production" ? env.VITE_API_URL : undefined)],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
    server: {
      host: true,
      port: Number(env.PORT) || 5173,
      proxy: {
        // Resolved by the dev server, not the browser: inside Docker this must be
        // the backend service name, not localhost.
        "/api": { target: env.DEV_PROXY_TARGET || "http://localhost:8000", changeOrigin: true },
      },
    },
    build: {
      chunkSizeWarningLimit: 2500,
      rollupOptions: {
        output: {
          manualChunks: (id: string) => (id.includes("node_modules/motion") ? "motion" : undefined),
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      css: false,
      coverage: {
        provider: "v8",
        include: ["src/**"],
        // the conveyor's rAF loop and the flight overlay are motion-driven; verified in a real browser
        exclude: [
          "src/components/MaterialRail/MaterialRail.tsx",
          "src/components/JevDecision/FlightLayer.tsx",
          "src/components/Studio.tsx",
          "src/App.tsx",
          "src/main.tsx",
          "src/**/*.test.*",
          "src/test/**",
          "src/**/*.d.ts",
        ],
        thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
      },
    },
  };
});
