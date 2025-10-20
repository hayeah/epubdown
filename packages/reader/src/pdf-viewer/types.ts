/**
 * Core types for the high-performance PDF viewer
 */

export type PageSize = {
  widthPt: number; // PDF points (1/72")
  heightPt: number;
};

export type RenderScale = {
  cssZoom: number; // User zoom level applied via CSS
  devicePixelRatio: number; // Screen DPR
  baseRasterScale: number; // Base scale for rasterization
};

export type TileRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export interface RenderPageOptions {
  pageIndex: number;
  scale: RenderScale;
  target: HTMLCanvasElement;
  tile?: TileRect | null;
  signal?: AbortSignal;
}

export interface TextRun {
  str: string;
  bbox: [number, number, number, number];
}

/**
 * Pluggable engine interface for PDF rendering
 * Supports both PDF.js and PDFium/WASM implementations
 */
export interface PdfEngine {
  /**
   * Load a PDF document from data or URL
   */
  load(
    data: ArrayBuffer | Uint8Array | URL,
  ): Promise<{ pageCount: number; getPageSize: (i: number) => PageSize }>;

  /**
   * Render a page to canvas
   */
  renderPageToCanvas(opts: RenderPageOptions): Promise<void>;

  /**
   * Get text runs for a page (optional, for text layer)
   */
  getTextRuns?(pageIndex: number): Promise<Array<TextRun>>;

  /**
   * Get WASM memory usage (PDFium only)
   */
  getWasmBytes?(): number;

  /**
   * Cleanup resources
   */
  dispose(): void;
}

/**
 * Performance sample collected during viewer operation
 */
export type PerfSample = {
  ts: number;
  route: "pdfjs" | "pdfium" | "mupdf";
  docId?: string;
  pageIndex?: number;
  ttfp_ms?: number; // Time to first page
  lastRender_ms?: number;
  jsHeap_bytes?: number;
  uaMemory?: unknown; // Browser-specific memory breakdown
  wasm_bytes?: number;
  gpuEst_bytes?: number; // Estimated GPU memory
  framesLast2s?: number;
  longTasksLast2s?: number;
  pagesAlive: number;
};

/**
 * Feature flags for runtime configuration
 */
export type FeatureFlags = {
  tiling: boolean;
  textLayer: boolean;
  thumbs: boolean;
  perfHUD: boolean;
  offscreenCanvas: boolean;
  threadsSIMD: boolean; // PDFium only
};

/**
 * Viewer capabilities detected at runtime
 */
export type ViewerCapabilities = {
  crossOriginIsolated: boolean;
  offscreenCanvasSupport: boolean;
  performanceMemoryAPI: boolean;
  intersectionObserver: boolean;
};

/**
 * Page render info tracked internally
 */
export type PageRenderInfo = {
  canvas: HTMLCanvasElement;
  rendered: boolean;
  timestamp: number;
  scale: RenderScale;
  pageIndex: number;
};

/**
 * Render task priority levels
 */
export enum RenderPriority {
  Visible = 10,
  Prefetch = 5,
  TextLayer = 3,
  Thumbnail = 1,
}

/**
 * Render task in the queue
 */
export type RenderTask = {
  priority: RenderPriority;
  pageIndex: number;
  scale: RenderScale;
  target: HTMLCanvasElement;
  tile?: TileRect | null;
  abortController: AbortController;
};
