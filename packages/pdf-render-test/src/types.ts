export type RendererKind = "PDFium" | "PDFJS";

export interface RenderOptions {
  renderer: RendererKind;
  ppi?: number; // default 96
  preload?: boolean; // default true
}

/** Adapter interface each engine must implement */
export interface PDFEngine {
  readonly name: RendererKind;
  init(): Promise<void>; // idempotent preload (WASM/registry/etc.)
  loadDocument(data: Uint8Array): Promise<DocumentHandle>;
}

export interface PageHandle {
  renderToCanvas(canvas: HTMLCanvasElement, ppi: number): Promise<void>;
  getTextCharCount?(): Promise<number>; // heuristic for scanned/vector
  destroy(): void;
}

export interface DocumentHandle {
  pageCount(): number;
  loadPage(pageIndex0: number): Promise<PageHandle>;
  destroy(): void;
}

/** UA Memory API normalized breakdown; null when not available */
export interface UAMemoryBreakdown {
  total_bytes: number | null;
  js_bytes: number | null;
  dom_bytes: number | null;
  wasm_bytes: number | null;
  canvas_bytes: number | null;
  other_bytes: number | null;
}

export interface MemorySample {
  ts_ms: number;
  ua: UAMemoryBreakdown | null; // normalized UA memory (or null)
  js_heap_bytes: number | null; // performance.memory.usedJSHeapSize (Chrome-only)
  canvas_estimated_bytes: number; // Σ(w*h*4) for canvases created by the harness
}

export interface PageRenderSample {
  page_index0: number;
  load_ms: number; // Time to load/parse page structure
  render_ms: number; // Time to render pixels to canvas
  memory_after?: MemorySample;
}

export interface EnvInfo {
  user_agent: string;
  platform: string;
  cross_origin_isolated: boolean;
  ppi: number;
  device_pixel_ratio: number;
}

export interface BatchReport {
  engine: RendererKind;
  pages_requested: number;
  pages_rendered: number;
  env: EnvInfo;

  // Timing (aggregate)
  total_load_ms: number; // Total time loading/parsing page structures
  total_render_ms: number; // Total time rendering pixels to canvas
  total_ms: number; // total_load_ms + total_render_ms
  pages_per_sec: number; // Based on total_ms
  total_load_formatted: string; // Human-readable load time
  total_render_formatted: string; // Human-readable render time
  total_formatted: string; // Human-readable total time

  // Memory (aggregate)
  memory_before: MemorySample | null;
  memory_after: MemorySample | null;
  ua_delta_total_bytes: number | null; // after.ua.total - before.ua.total
  canvas_estimated_delta_bytes: number; // after.estimate - before.estimate
  ua_delta_formatted: string; // Human-readable memory delta
  canvas_delta_formatted: string; // Human-readable canvas memory

  // Per-page (optional)
  per_page?: PageRenderSample[];
}
