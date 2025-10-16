import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../vitest.config.browser.shared.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Try to find turndown - same logic as vite.config.ts
let turndownPath: string | undefined;
const possiblePaths = [
  "turndown/lib/turndown.browser.es.js",
  "turndown/src/turndown.js",
];

for (const testPath of possiblePaths) {
  try {
    turndownPath = require.resolve(testPath);
    break;
  } catch {
    // Try next path
  }
}

export default mergeConfig(
  shared,
  defineConfig({
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "fs/promises": path.resolve(__dirname, "./src/lib/fs-stub.ts"),
        ...(turndownPath ? { turndown: turndownPath } : {}),
      },
    },
  }),
);
