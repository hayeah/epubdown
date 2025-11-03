import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "PdfRender",
      fileName: "index",
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "react",
        "react/jsx-runtime",
        "@embedpdf/pdfium",
        "pdfjs-dist",
      ],
      output: {
        globals: {
          react: "React",
        },
      },
    },
    target: "esnext",
    sourcemap: true,
  },
});
