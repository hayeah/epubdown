import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
// import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  // assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    include: ["turndown"],
    esbuildOptions: {
      mainFields: ["module", "main"],
    },
  },
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
      // "wa-sqlite/dist": path.resolve(__dirname, "./node_modules/wa-sqlite/dist"),
      // Stub out fs/promises for browser
      "fs/promises": path.resolve(__dirname, "./src/lib/fs-stub.ts"),
      // Explicitly resolve turndown to its browser ES module
      turndown: path.resolve(
        __dirname,
        "../../node_modules/.pnpm/turndown@7.2.0/node_modules/turndown/lib/turndown.browser.es.js",
      ),
    },
  },
});
