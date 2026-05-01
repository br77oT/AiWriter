import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    // Anchor jsdom at a real http origin so tests that exercise URL state
    // (history.replaceState, location.search) work — the default
    // "about:blank" rejects same-origin replaceState calls.
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },
    setupFiles: ["./vitest.setup.ts"],
    css: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
