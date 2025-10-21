import { sampleMemory } from "../metrics/memory.js";
import {
  computeCanvasDelta,
  computePagesPerSec,
  computeUADelta,
} from "../metrics/report.js";
import type { BatchReport, PDFEngine, PageRenderSample } from "../types.js";
import { formatTime, formatMemory } from "../util/format.js";

export interface BatchOptions {
  engine: PDFEngine;
  data: Uint8Array;
  pages: number;
  startPage?: number; // 1-based, default 1
  ppi?: number; // default 96
  canvasFactory: () => HTMLCanvasElement;
  collectPerPage?: boolean; // default true
  onAfterEach?: (i0: number, ms: number) => void;
}

export async function runBatch(opts: BatchOptions): Promise<BatchReport> {
  const {
    engine,
    data,
    pages,
    startPage = 1,
    ppi = 96,
    canvasFactory,
    collectPerPage = true,
  } = opts;

  await engine.init();
  const doc = await engine.loadDocument(data);
  const canvases: HTMLCanvasElement[] = [];

  const totalPages = doc.pageCount();
  const actualPages = Math.min(
    pages,
    Math.max(0, totalPages - (startPage - 1)),
  );

  const env = {
    user_agent: navigator.userAgent,
    platform: navigator.platform,
    cross_origin_isolated: (self as any).crossOriginIsolated === true,
    ppi,
    device_pixel_ratio: window.devicePixelRatio,
  };

  const memory_before = await sampleMemory(canvases);

  let total_load_ms = 0;
  let total_render_ms = 0;
  const per_page: PageRenderSample[] = [];

  for (let i = 0; i < actualPages; i++) {
    const pageIndex0 = startPage - 1 + i;
    const canvas = canvasFactory();
    canvases.push(canvas);
    document.body.appendChild(canvas);

    // Measure page load time (parsing page structure)
    const t0 = performance.now();
    const page = await doc.loadPage(pageIndex0);
    const load_ms = performance.now() - t0;

    // Measure render time (painting pixels to canvas)
    const t1 = performance.now();
    await page.renderToCanvas(canvas, ppi);
    await new Promise(requestAnimationFrame); // ensure paint committed
    const render_ms = performance.now() - t1;

    total_load_ms += load_ms;
    total_render_ms += render_ms;

    if (collectPerPage) {
      const memory_after = await sampleMemory(canvases);
      per_page.push({
        page_index0: pageIndex0,
        load_ms,
        render_ms,
        memory_after,
      });
    }
    opts.onAfterEach?.(pageIndex0, load_ms + render_ms);

    // Clean up page handle
    page.destroy();
  }

  const memory_after = await sampleMemory(canvases);

  const ua_delta = computeUADelta(memory_before, memory_after);
  const canvas_delta = computeCanvasDelta(memory_before, memory_after);

  const total_ms = total_load_ms + total_render_ms;

  const report: BatchReport = {
    engine: engine.name,
    pages_requested: pages,
    pages_rendered: actualPages,
    env,
    total_load_ms,
    total_render_ms,
    total_ms,
    pages_per_sec: computePagesPerSec(total_ms, actualPages),
    total_load_formatted: formatTime(total_load_ms),
    total_render_formatted: formatTime(total_render_ms),
    total_formatted: formatTime(total_ms),
    memory_before,
    memory_after,
    ua_delta_total_bytes: ua_delta,
    canvas_estimated_delta_bytes: canvas_delta,
    ua_delta_formatted: formatMemory(ua_delta ?? undefined),
    canvas_delta_formatted: formatMemory(canvas_delta),
    per_page: collectPerPage ? per_page : undefined,
  };

  doc.destroy();
  return report;
}
