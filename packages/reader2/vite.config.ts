import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  server: {
    port: 5180,
    host: "0.0.0.0",
  },
  build: {
    target: "esnext",
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
      "fs/promises": resolve(__dirname, "./src/lib/fs-stub.ts"),
    },
  },
  lint: {
    options: {
      typeCheck: false,
    },
  },
});
