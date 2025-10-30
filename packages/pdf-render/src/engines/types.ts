export type RendererKind = "PDFium" | "PDFJS";

export interface EngineInitOptions {
  wasmUrl?: string;
  disableWorker?: boolean;
}

export interface PageSizePt {
  wPt: number;
  hPt: number;
}

export interface PageHandle {
  renderToCanvas(canvas: HTMLCanvasElement, ppi: number): Promise<void>;
  destroy(): void;
}

export interface DocumentHandle {
  pageCount(): number;
  getPageSize(pageIndex0: number): Promise<PageSizePt>;
  loadPage(pageIndex0: number): Promise<PageHandle>;
  destroy(): void;
}

export interface PDFEngine {
  readonly name: RendererKind;
  init(opts?: EngineInitOptions): Promise<void>;
  loadDocument(data: Uint8Array): Promise<DocumentHandle>;
}
