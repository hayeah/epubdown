import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type {
  DocumentHandle,
  PageHandle,
  PageSizePt,
  PDFEngine,
} from "./types";

export function createPdfjsEngine(): PDFEngine {
  return {
    name: "PDFJS",
    async init({ disableWorker = false } = {}) {
      if (
        !disableWorker &&
        typeof window !== "undefined" &&
        pdfjsLib.GlobalWorkerOptions
      ) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.mjs",
          import.meta.url,
        ).href;
      }
      if (disableWorker) {
        const g: any = pdfjsLib.GlobalWorkerOptions;
        g.workerSrc = undefined;
        g.workerPort = null;
      }
    },
    async loadDocument(data: Uint8Array): Promise<DocumentHandle> {
      const task = pdfjsLib.getDocument({
        data,
        disableStream: true,
        disableAutoFetch: true,
        disableRange: true,
      });
      const pdf = await task.promise;

      const getPageSize = async (index0: number): Promise<PageSizePt> => {
        const page = await pdf.getPage(index0 + 1);
        const viewport = page.getViewport({ scale: 1 });
        page.cleanup();
        return { wPt: viewport.width, hPt: viewport.height };
      };

      return {
        pageCount: () => pdf.numPages,
        getPageSize,
        async loadPage(index0): Promise<PageHandle> {
          const page = await pdf.getPage(index0 + 1);
          return {
            async renderToCanvas(canvas, ppi) {
              const viewport = page.getViewport({ scale: (ppi ?? 96) / 72 });
              canvas.width = Math.max(1, Math.floor(viewport.width));
              canvas.height = Math.max(1, Math.floor(viewport.height));
              const ctx = canvas.getContext("2d");
              if (!ctx) throw new Error("Canvas 2D context unavailable");
              await page.render({ canvasContext: ctx, viewport }).promise;
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
