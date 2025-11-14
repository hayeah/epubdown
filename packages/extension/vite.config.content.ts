import { resolve } from "node:path";
import { defineConfig } from "vite";

// Separate config for content script - must be IIFE format
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/content/contentScript.ts"),
      name: "ContentScript",
      formats: ["iife"],
      fileName: () => "content/contentScript.js",
    },
    rollupOptions: {
      external: ["chrome"],
      output: {
        entryFileNames: "content/contentScript.js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "content.css";
          }
          return "[name][extname]";
        },
        extend: true,
        // Make chrome global available
        globals: {
          chrome: "chrome",
        },
      },
    },
  },
});
