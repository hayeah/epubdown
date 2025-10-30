import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/tests/browser/**/*.spec.ts"],
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
