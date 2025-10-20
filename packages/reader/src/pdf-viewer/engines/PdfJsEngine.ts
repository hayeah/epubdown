/**
 * PDF.js engine adapter
 * Wraps pdfjs-dist with our PdfEngine interface
 */

import * as pdfjsLib from "pdfjs-dist";
import type { PageSize, PdfEngine, RenderPageOptions, TextRun } from "../types";

// Configure worker
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

export class PdfJsEngine implements PdfEngine {
  private pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  private pageSizes: Map<number, PageSize> = new Map();

  async load(
    data: ArrayBuffer | Uint8Array | URL,
  ): Promise<{ pageCount: number; getPageSize: (i: number) => PageSize }> {
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask;

    if (data instanceof URL) {
      loadingTask = pdfjsLib.getDocument(data.toString());
    } else {
      // Create a deep copy to prevent the ArrayBuffer from being detached when transferred to worker
      // PDF.js will transfer the ArrayBuffer to its worker, detaching the original
      const sourceArray =
        data instanceof Uint8Array ? data : new Uint8Array(data);
      const dataCopy = new Uint8Array(sourceArray.length);
      dataCopy.set(sourceArray);

      loadingTask = pdfjsLib.getDocument({
        data: dataCopy,
        // Disable stream to prevent issues with transferred ArrayBuffers
        disableStream: true,
      });
    }

    this.pdfDoc = await loadingTask.promise;

    // Pre-fetch page sizes for all pages
    const pageCount = this.pdfDoc.numPages;
    for (let i = 0; i < pageCount; i++) {
      const page = await this.pdfDoc.getPage(i + 1); // PDF.js uses 1-based indexing
      const viewport = page.getViewport({ scale: 1.0 });
      this.pageSizes.set(i, {
        widthPt: viewport.width,
        heightPt: viewport.height,
      });
    }

    return {
      pageCount,
      getPageSize: (i: number) => {
        const size = this.pageSizes.get(i);
        if (!size) {
          throw new Error(`Page size not found for page ${i}`);
        }
        return size;
      },
    };
  }

  async renderPageToCanvas(opts: RenderPageOptions): Promise<void> {
    if (!this.pdfDoc) {
      throw new Error("PDF document not loaded");
    }

    const { pageIndex, scale, target, tile, signal } = opts;

    // PDF.js uses 1-based page numbers
    const page = await this.pdfDoc.getPage(pageIndex + 1);

    // Calculate effective scale
    const effectiveScale =
      scale.cssZoom * scale.devicePixelRatio * scale.baseRasterScale;

    const viewport = page.getViewport({ scale: effectiveScale });

    // Setup canvas
    const context = target.getContext("2d");
    if (!context) {
      throw new Error("Failed to get 2D context");
    }

    // Handle tiling if specified
    if (tile) {
      // For tiling, adjust viewport and canvas
      target.width = tile.w;
      target.height = tile.h;

      // Transform context to render only the tile portion
      context.save();
      context.translate(-tile.x, -tile.y);
    } else {
      // Full page render
      target.width = viewport.width;
      target.height = viewport.height;
    }

    // Apply CSS styles to maintain physical size
    const cssScale = scale.devicePixelRatio * scale.baseRasterScale;
    target.style.width = `${viewport.width / cssScale}px`;
    target.style.height = `${viewport.height / cssScale}px`;

    // Render with abort support
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      canvas: target,
    };

    const renderTask = page.render(renderContext);

    // Handle abort signal
    if (signal) {
      signal.addEventListener("abort", () => {
        renderTask.cancel();
      });
    }

    try {
      await renderTask.promise;
    } finally {
      if (tile) {
        context.restore();
      }
    }
  }

  async getTextRuns(pageIndex: number): Promise<Array<TextRun>> {
    if (!this.pdfDoc) {
      throw new Error("PDF document not loaded");
    }

    const page = await this.pdfDoc.getPage(pageIndex + 1);
    const textContent = await page.getTextContent();

    return textContent.items.map((item: any) => {
      // Transform can be [scaleX, skewX, skewY, scaleY, transX, transY]
      const transform = item.transform;
      const x = transform[4];
      const y = transform[5];
      const width = item.width;
      const height = item.height;

      return {
        str: item.str,
        bbox: [x, y, x + width, y + height],
      };
    });
  }

  dispose(): void {
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
      this.pdfDoc = null;
    }
    this.pageSizes.clear();
  }
}
