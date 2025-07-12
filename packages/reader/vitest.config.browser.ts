import { nodePolyfills } from "vite-plugin-node-polyfills";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ["path"],
      protocolImports: true, // lets "node:path" resolve cleanly
    }),
  ],
  server: {
    fs: {
      allow: ["../../epubs"],
    },
  },
  publicDir: "../../epubs",
  test: {
    browser: {
      enabled: true,
      provider: "playwright",
      headless: true,
      instances: [
        {
          browser: "chromium",
        },
      ],
    },
    include: ["**/*.test.browser.{js,ts,jsx,tsx}"],
  },
});
