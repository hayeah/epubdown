import { createPdfjsEngine } from "./engines/pdfjs.js";
import { createPdfiumEngine } from "./engines/pdfium.js";
import type { RenderOptions } from "./types.js";
import { normalizeToUint8 } from "./util/blobs.js";

export async function renderPDFToDom(
  pdfFile: Blob | ArrayBuffer | Uint8Array,
  pageNumber: number, // 1-based
  domCanvasElement: HTMLCanvasElement,
  options: RenderOptions,
): Promise<{ ms: number; canvasBytes: number }> {
  const { renderer, ppi = 96, preload = true } = options;
  const data = await normalizeToUint8(pdfFile);

  const engine =
    renderer === "PDFium" ? createPdfiumEngine() : createPdfjsEngine();

  if (preload) {
    await engine.init();
  }

  const doc = await engine.loadDocument(data);
  const pageIndex0 = pageNumber - 1;

  // Validate page number
  const totalPages = doc.pageCount();
  if (pageIndex0 < 0 || pageIndex0 >= totalPages) {
    throw new Error(
      `Invalid page number ${pageNumber}. Document has ${totalPages} pages (valid range: 1-${totalPages})`,
    );
  }

  const t0 = performance.now();
  const page = await doc.loadPage(pageIndex0);
  await page.renderToCanvas(domCanvasElement, ppi);
  const ms = performance.now() - t0;

  const canvasBytes = domCanvasElement.width * domCanvasElement.height * 4;

  page.destroy();
  doc.destroy();

  return { ms, canvasBytes };
}

// Export everything for library consumers
export * from "./types.js";
export { createPdfjsEngine } from "./engines/pdfjs.js";
export { createPdfiumEngine } from "./engines/pdfium.js";
export { runBatch, type BatchOptions } from "./harness/runBatch.js";
export { sampleMemory } from "./metrics/memory.js";
export { normalizeUAMemory } from "./metrics/uaMemory.js";
export {
  computePagesPerSec,
  computeUADelta,
  computeCanvasDelta,
} from "./metrics/report.js";
export { time, pagesPerSecond } from "./metrics/timing.js";
export { normalizeToUint8 } from "./util/blobs.js";
export { estimateCanvasBytes } from "./util/canvas.js";
export { ppiToScale } from "./util/ppi.js";
export {
  formatTime,
  formatBytes,
  formatRate,
  formatNumber,
  formatBatchReport,
} from "./utils/format.js";
