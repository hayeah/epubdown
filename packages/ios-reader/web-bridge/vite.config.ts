import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  base: "./",
  server: {
    port: 5190,
    host: "0.0.0.0",
  },
  build: {
    target: "esnext",
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ["path"],
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      "fs/promises": resolve(__dirname, "./src/fs-stub.ts"),
    },
  },
  lint: {
    options: {
      typeCheck: false,
    },
  },
});
