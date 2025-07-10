import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "SqliteBrowser",
      fileName: "index",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["wa-sqlite"],
      output: {
        globals: {
          "wa-sqlite": "waSqlite",
        },
      },
    },
    target: "esnext",
    sourcemap: true,
  },
  optimizeDeps: {
    exclude: ["wa-sqlite"],
  },
});
