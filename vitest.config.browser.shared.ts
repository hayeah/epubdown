import { nodePolyfills } from "vite-plugin-node-polyfills";
import { defineConfig } from "vitest/config";

/**
 * Shared Vitest configuration for browser tests across all packages
 */
export const sharedBrowserConfig = defineConfig({
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
      headless: false,
      instances: [
        {
          browser: "chromium",
        },
      ],
    },
    include: ["**/*.test.browser.{js,ts,jsx,tsx}"],
  },
});

export default sharedBrowserConfig;
