/**
 * High-performance PDF viewer exports
 */

// Components
export { PdfViewerHP } from "./components/PdfViewerHP";
export type { PdfViewerHPProps } from "./components/PdfViewerHP";
export { PdfViewerHPPage } from "./PdfViewerHPPage";

// Types
export type {
  PageSize,
  RenderScale,
  TileRect,
  RenderPageOptions,
  TextRun,
  PdfEngine,
  PerfSample,
  FeatureFlags,
  ViewerCapabilities,
  PageRenderInfo,
  RenderTask,
} from "./types";
export { RenderPriority } from "./types";

// Engines
export { PdfJsEngine } from "./engines/PdfJsEngine";

// Managers
export { CanvasPool } from "./CanvasPool";
export { VirtualizationManager } from "./VirtualizationManager";
export { RenderQueue } from "./RenderQueue";
export { ZoomManager } from "./ZoomManager";
export { PerformanceSampler } from "./PerformanceSampler";
