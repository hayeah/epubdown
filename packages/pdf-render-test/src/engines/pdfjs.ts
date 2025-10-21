// Use the legacy build for better compatibility
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { DocumentHandle, PDFEngine, PageHandle } from "../types.js";

// Disable the worker completely for single-threaded operation
if (typeof window !== "undefined" && pdfjsLib.GlobalWorkerOptions) {
  // Use inline worker code to avoid external file loading
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url,
  ).href;
}

export function createPdfjsEngine(): PDFEngine {
  return {
    name: "PDFJS",
    async init() {
      // Worker is already configured above
    },
    async loadDocument(data: Uint8Array): Promise<DocumentHandle> {
      const task = pdfjsLib.getDocument({
        data,
        disableStream: true,
        disableAutoFetch: true,
        disableRange: true,
        disableFontFace: false,
      });
      const pdf = await task.promise;
      return {
        pageCount: () => pdf.numPages,
        async loadPage(pageIndex0): Promise<PageHandle> {
          const page = await pdf.getPage(pageIndex0 + 1);
          return {
            async renderToCanvas(canvas, ppi) {
              const scale = (ppi ?? 96) / 72;
              const viewport = page.getViewport({ scale });
              canvas.width = Math.max(1, Math.floor(viewport.width));
              canvas.height = Math.max(1, Math.floor(viewport.height));
              const ctx = canvas.getContext("2d");
              if (!ctx) throw new Error("Failed to get 2d context");
              await page.render({ canvasContext: ctx, viewport }).promise;
            },
            async getTextCharCount() {
              const text = await page.getTextContent();
              return text.items.length;
            },
            destroy() {
              page.cleanup();
            },
          };
        },
        destroy() {
          pdf.destroy();
        },
      };
    },
  };
}
