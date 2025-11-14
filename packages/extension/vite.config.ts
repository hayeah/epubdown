import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-manifest-and-icons",
      closeBundle() {
        const dist = resolve(__dirname, "dist");
        const publicDir = resolve(__dirname, "public");

        // Copy manifest
        copyFileSync(
          resolve(publicDir, "manifest.json"),
          resolve(dist, "manifest.json"),
        );

        // Copy icons
        for (const size of [16, 48, 128]) {
          copyFileSync(
            resolve(publicDir, `icon${size}.svg`),
            resolve(dist, `icon${size}.svg`),
          );
        }
      },
    },
  ],
  publicDir: false, // Disable default public dir copying
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background/service_worker.ts"),
        // content script built separately with vite.config.content.ts
        panel: resolve(__dirname, "src/panel/index.html"),
        popup: resolve(__dirname, "src/popup/popup.html"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Background script and content script should be in their respective folders
          if (chunkInfo.name === "background") {
            return "background/service_worker.js";
          }
          if (chunkInfo.name === "content") {
            return "content/contentScript.js";
          }
          return "[name].js";
        },
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || "";
          if (name.endsWith(".css")) {
            // Keep CSS with content script
            if (name.includes("contentScript")) {
              return "content/contentScript.css";
            }
            // Other CSS files go to root
            return "[name][extname]";
          }
          return "assets/[name][extname]";
        },
      },
    },
    // Ensure source maps for debugging
    sourcemap: process.env.NODE_ENV === "development",
    // Don't minify in development for easier debugging
    minify: process.env.NODE_ENV !== "development",
  },
});
