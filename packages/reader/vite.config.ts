import path from "node:path";
import { createRequire } from "node:module";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
// import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const require = createRequire(import.meta.url);

// Try to find turndown - handle GitHub source version and prebuilt versions
let turndownPath;

// First check if there's a lib folder (prebuilt version)
const possiblePaths = [
  // Prebuilt versions
  "turndown/lib/turndown.browser.es.js",
  // Source version for GitHub install
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

export default defineConfig({
  // assetsInclude: ["**/*.wasm"],
  build: {
    target: "es2022", // Support top-level await
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        libraryPrototype: path.resolve(
          __dirname,
          "prototype/library/index.html",
        ),
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    // only polyfill what you need to keep the bundle small
    nodePolyfills({
      include: ["path"],
      protocolImports: true, // lets "node:path" resolve cleanly
    }),
    // visualizer(), // Temporarily disabled due to ES module issue
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Stub out fs/promises for browser
      "fs/promises": path.resolve(__dirname, "./src/lib/fs-stub.ts"),
      // Only set turndown alias if we found it
      ...(turndownPath ? { "turndown": turndownPath } : {}),
    },
  },
});
