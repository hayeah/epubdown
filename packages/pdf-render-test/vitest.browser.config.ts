import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  publicDir: resolve(import.meta.dirname, "public"),
  test: {
    include: ["tests/browser/**/*.spec.ts"],
    browser: {
      enabled: true,
      name: "chromium",
      headless: true,
      provider: "playwright",
    },
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
