import { sampleMemory } from "../metrics/memory.js";
import {
  computeCanvasDelta,
  computePagesPerSec,
  computeUADelta,
} from "../metrics/report.js";
import type { BatchReport, PDFEngine, PageRenderSample } from "../types.js";
import { formatTime, formatBytesSigned } from "../utils/format.js";

export interface BatchOptions {
  engine: PDFEngine;
  data: Uint8Array;
  pages: number;
  startPage?: number; // 1-based, default 1
  ppi?: number; // default 96
  canvasFactory: () => HTMLCanvasElement;
  collectPerPage?: boolean; // default true
  onAfterEach?: (i0: number, ms: number) => void;
  /**
   * Canvas display mode (default: 'reuse-one')
   * - 'reuse-one': Reuse a single canvas (best for perf testing, avoids composite inflation)
   * - 'append-all': Append all canvases to DOM (real-world "page wall" UX)
   * - 'off-screen': Render off-screen to isolate composite from rasterization
   */
  canvasMode?: "append-all" | "reuse-one" | "off-screen";
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
    canvasMode = "reuse-one",
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

  // Measure baseline composite time (one rAF with no work)
  // This helps account for frame-quantization overhead
  let baselineCompositeTimes: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    await new Promise(requestAnimationFrame);
    baselineCompositeTimes.push(performance.now() - t);
  }
  const baselineCompositeMs =
    baselineCompositeTimes.reduce((a, b) => a + b, 0) /
    baselineCompositeTimes.length;

  let total_load_ms = 0;
  let total_render_ms = 0;
  let total_composite_ms = 0;
  const per_page: PageRenderSample[] = [];

  // Create container for off-screen mode
  let offScreenContainer: HTMLDivElement | null = null;
  if (canvasMode === "off-screen") {
    offScreenContainer = document.createElement("div");
    offScreenContainer.style.position = "fixed";
    offScreenContainer.style.left = "-99999px";
    offScreenContainer.style.top = "0";
    document.body.appendChild(offScreenContainer);
  }

  // For reuse mode, create a single canvas
  let reusableCanvas: HTMLCanvasElement | null = null;
  if (canvasMode === "reuse-one") {
    reusableCanvas = canvasFactory();
    document.body.appendChild(reusableCanvas);
  }

  for (let i = 0; i < actualPages; i++) {
    const pageIndex0 = startPage - 1 + i;
    let canvas: HTMLCanvasElement;

    if (canvasMode === "reuse-one" && reusableCanvas) {
      // Reuse the same canvas
      canvas = reusableCanvas;
    } else {
      // Create new canvas for this page
      canvas = canvasFactory();
      if (canvasMode === "off-screen" && offScreenContainer) {
        offScreenContainer.appendChild(canvas);
      } else if (canvasMode === "append-all") {
        document.body.appendChild(canvas);
      }
      canvases.push(canvas);
    }

    // Phase 1: Measure page load time (parsing page structure)
    const t0 = performance.now();
    const page = await doc.loadPage(pageIndex0);
    const load_ms = performance.now() - t0;

    // Phase 2: Measure render time (engine painting pixels to canvas)
    const t1 = performance.now();
    await page.renderToCanvas(canvas, ppi);
    const render_ms = performance.now() - t1;

    // Phase 3: Measure browser composite time (getting pixels to screen)
    // This captures the real-world overhead of browser compositing, GPU upload, etc.
    // Subtract baseline to account for frame-quantization overhead
    const t2 = performance.now();
    await new Promise(requestAnimationFrame);
    const rawCompositeMs = performance.now() - t2;
    const composite_ms = Math.max(0, rawCompositeMs - baselineCompositeMs);

    const total_ux_ms = load_ms + render_ms + composite_ms;

    total_load_ms += load_ms;
    total_render_ms += render_ms;
    total_composite_ms += composite_ms;

    if (collectPerPage) {
      // Sample memory - in reuse-one mode, we need to include the reusable canvas
      const memory_after = await sampleMemory(
        canvasMode === "reuse-one" && reusableCanvas
          ? [reusableCanvas]
          : canvases,
      );
      per_page.push({
        page_index0: pageIndex0,
        load_ms,
        render_ms,
        composite_ms,
        total_ux_ms,
        memory_after,
      });
    }
    opts.onAfterEach?.(pageIndex0, total_ux_ms);

    // Clean up page handle
    page.destroy();
  }

  // Clean up off-screen container if used
  if (offScreenContainer) {
    document.body.removeChild(offScreenContainer);
  }

  const memory_after = await sampleMemory(
    canvasMode === "reuse-one" && reusableCanvas ? [reusableCanvas] : canvases,
  );

  const ua_delta = computeUADelta(memory_before, memory_after);
  const canvas_delta = computeCanvasDelta(memory_before, memory_after);

  const total_ux_ms = total_load_ms + total_render_ms + total_composite_ms;

  const report: BatchReport = {
    engine: engine.name,
    pages_requested: pages,
    pages_rendered: actualPages,
    env,
    total_load_ms,
    total_render_ms,
    total_composite_ms,
    total_ux_ms,
    pages_per_sec: computePagesPerSec(total_ux_ms, actualPages),
    total_load_formatted: formatTime(total_load_ms),
    total_render_formatted: formatTime(total_render_ms),
    total_composite_formatted: formatTime(total_composite_ms),
    total_ux_formatted: formatTime(total_ux_ms),
    memory_before,
    memory_after,
    ua_delta_total_bytes: ua_delta,
    canvas_estimated_delta_bytes: canvas_delta,
    ua_delta_formatted: formatBytesSigned(ua_delta),
    canvas_delta_formatted: formatBytesSigned(canvas_delta),
    per_page: collectPerPage ? per_page : undefined,
  };

  doc.destroy();
  return report;
}
