// Use the legacy build for better compatibility
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { DocumentHandle, PDFEngine, PageHandle } from "../types.js";

// Configure the worker by default (for multi-threaded operation)
// Can be disabled per-engine instance for single-threaded benchmarking
if (typeof window !== "undefined" && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url,
  ).href;
}

export interface PdfjsEngineOptions {
  /** Disable worker for single-threaded operation (default: false) */
  disableWorker?: boolean;
}

export function createPdfjsEngine(options: PdfjsEngineOptions = {}): PDFEngine {
  const { disableWorker = false } = options;

  // Save original worker configuration
  let prevWorkerSrc: string | undefined;
  let prevWorkerPort: any;

  return {
    name: "PDFJS",
    async init() {
      // Worker is already configured above
    },
    async loadDocument(data: Uint8Array): Promise<DocumentHandle> {
      // Disable worker if requested by temporarily clearing GlobalWorkerOptions
      if (disableWorker) {
        prevWorkerSrc = pdfjsLib.GlobalWorkerOptions.workerSrc;
        prevWorkerPort = (pdfjsLib.GlobalWorkerOptions as any).workerPort;
        pdfjsLib.GlobalWorkerOptions.workerSrc = undefined as any;
        (pdfjsLib.GlobalWorkerOptions as any).workerPort = null;
      }

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
          if (pageIndex0 < 0 || pageIndex0 >= pdf.numPages) {
            throw new Error(
              `Invalid page index ${pageIndex0}. Document has ${pdf.numPages} pages (valid range: 0-${pdf.numPages - 1})`,
            );
          }
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
              // Count actual characters, not text items
              return text.items.reduce((sum, item) => {
                if ("str" in item) {
                  return sum + item.str.length;
                }
                return sum;
              }, 0);
            },
            destroy() {
              page.cleanup();
            },
          };
        },
        destroy() {
          pdf.destroy();
          // Restore worker configuration if it was disabled
          if (disableWorker) {
            if (prevWorkerSrc !== undefined) {
              pdfjsLib.GlobalWorkerOptions.workerSrc = prevWorkerSrc;
            }
            (pdfjsLib.GlobalWorkerOptions as any).workerPort = prevWorkerPort;
          }
        },
      };
    },
  };
}
