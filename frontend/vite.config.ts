/// <reference types="vitest/config" />
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss()],
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
