import { makeAutoObservable, observable, runInAction } from "mobx";
import { DEFAULT_PDFIUM_WASM_URL } from "@embedpdf/pdfium";
import type { AppEventSystem } from "../app/context";
import type { BookLibraryStore } from "./BookLibraryStore";
import {
  createPdfiumEngine,
  createPdfjsEngine,
  type DocumentHandle,
  type PDFEngine,
  type RendererKind,
} from "@epubdown/pdf-render";
import { PageRecord } from "./PageRecord";
import { PdfCanvasCache } from "./PdfCanvasCache";
import { PdfRenderScheduler } from "./PdfRenderScheduler";
import { DEFAULT_PAGE_PT } from "../pdf/pdfConstants";
import type { PdfPageSizeCache } from "../lib/PdfPageSizeCache";

export type { PageStatus } from "./PageRecord";
export type { PageRecord } from "./PageRecord";

export class PdfReaderStore {
  engineKind: RendererKind = "PDFium";
  engine: PDFEngine | null = null;
  doc: DocumentHandle | null = null;
  pdfBytes: Uint8Array | null = null;

  ppi = 144;
  pageCount = 0;
  pages: PageRecord[] = [];
  // Revision counter to force re-renders when dimensions change
  dimensionRevision = 0;

  memoryBudgetBytes = 256 * 1024 * 1024;
  canvasBytes = 0;
  private cache: PdfCanvasCache;
  private scheduler: PdfRenderScheduler;

  visibleSet = new Set<number>();
  scrollIdleMs = 120;
  private scrollIdleTimer: number | null = null;

  isLoading = false;
  error: string | null = null;
  currentBookId: number | null = null;
  // Observable so page indicator updates when page changes
  currentPageIndex = 0;
  // Position within current page (0.0 = top, 1.0 = bottom)
  // Non-observable to prevent re-renders during scroll
  currentPosition = 0;

  constructor(
    private lib: BookLibraryStore,
    private events: AppEventSystem,
    private pageSizeCache: PdfPageSizeCache,
  ) {
    this.cache = new PdfCanvasCache(
      this.memoryBudgetBytes,
      this.pages,
      (bytes) => {
        this.canvasBytes = bytes;
      },
    );
    this.scheduler = new PdfRenderScheduler(
      async () => await this.performRenderCycle(),
    );
    makeAutoObservable(
      this,
      {
        pages: observable.shallow,
        // Only currentPosition is non-observable to prevent re-renders during scroll
        // currentPageIndex and currentPage are observable so UI updates when page changes
        currentPosition: false,
      },
      { autoBind: true },
    );
  }

  get currentPage(): number {
    return this.currentPageIndex + 1;
  }

  async load(bookId: number) {
    this.dispose();
    runInAction(() => {
      this.isLoading = true;
      this.error = null;
      this.currentBookId = bookId;
    });

    try {
      const data = await this.lib.loadBookForReading(bookId);
      if (!data) throw new Error("Book not found");
      const bytes = new Uint8Array(await data.blob.arrayBuffer());
      await this.open(bytes, this.engineKind);
      runInAction(() => {
        this.isLoading = false;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      runInAction(() => {
        this.error = message;
        this.isLoading = false;
      });
    }
  }

  private makeEngine(kind: RendererKind): PDFEngine {
    return kind === "PDFium" ? createPdfiumEngine() : createPdfjsEngine();
  }

  async open(data: Uint8Array, kind: RendererKind = "PDFium") {
    this.disposeDocument();
    this.pdfBytes = data;
    this.engineKind = kind;
    const engine = this.makeEngine(kind);
    const initOptions =
      kind === "PDFium" ? { wasmUrl: DEFAULT_PDFIUM_WASM_URL } : undefined;
    await engine.init(initOptions);
    const doc = await engine.loadDocument(data);

    runInAction(() => {
      this.engine = engine;
      this.doc = doc;
      this.pageCount = doc.pageCount();
      this.pages = Array.from(
        { length: this.pageCount },
        (_, index0) => new PageRecord(index0),
      );
      // Reinitialize cache with new pages
      this.cache = new PdfCanvasCache(
        this.memoryBudgetBytes,
        this.pages,
        (bytes) => {
          this.canvasBytes = bytes;
        },
      );
      this.visibleSet = new Set();
      this.currentPageIndex = 0;
    });

    // Try to load page sizes from cache
    let cachedSizes = null;
    if (this.currentBookId !== null) {
      cachedSizes = await this.pageSizeCache.getPageSizes(this.currentBookId);
    }

    if (cachedSizes && cachedSizes.length === this.pageCount) {
      // Apply cached sizes
      runInAction(() => {
        for (const size of cachedSizes) {
          const page = this.pages[size.pageIndex];
          if (page) {
            page.wPt = size.widthPt;
            page.hPt = size.heightPt;
            page.setSizeFromPt(this.ppi);
            page.status = "ready";
          }
        }
        // Increment revision to trigger re-renders with new dimensions
        this.dimensionRevision++;
      });
    } else {
      // Load all page sizes and cache them
      const sizes = [];
      for (let i = 0; i < this.pageCount; i++) {
        await this.ensureSize(i);
        const page = this.pages[i];
        if (page?.wPt && page?.hPt) {
          sizes.push({
            pageIndex: i,
            widthPt: page.wPt,
            heightPt: page.hPt,
          });
        }
      }

      // Save to cache
      if (this.currentBookId !== null && sizes.length === this.pageCount) {
        await this.pageSizeCache.savePageSizes(this.currentBookId, sizes);
      }

      // Increment revision to trigger re-renders with new dimensions
      runInAction(() => {
        this.dimensionRevision++;
      });
    }

    this.scheduler.trigger();
  }

  async setEngine(kind: RendererKind) {
    if (kind === this.engineKind) return;
    if (!this.pdfBytes) {
      this.engineKind = kind;
      return;
    }
    runInAction(() => {
      this.isLoading = true;
      this.error = null;
    });
    try {
      await this.open(this.pdfBytes, kind);
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  setPpi(ppi: number) {
    if (ppi === this.ppi) return;
    this.ppi = ppi;
    this.canvasBytes = 0;
    for (const page of this.pages) {
      page.setSizeFromPt(this.ppi);
      if (page.canvas) {
        this.cache.noteDetach(page);
      }
      if (page.status === "rendered") {
        page.status = "ready";
      }
    }
    // Increment revision to trigger re-renders
    this.dimensionRevision++;
    this.writeUrl();
    this.scheduler.trigger();
  }

  onPagesVisible(indexes: number[]) {
    const next = new Set(indexes);
    this.visibleSet = next;
    this.scheduler.trigger();
  }

  onScroll() {
    if (this.scrollIdleTimer !== null) {
      window.clearTimeout(this.scrollIdleTimer);
    }
    this.scrollIdleTimer = window.setTimeout(() => {
      this.scrollIdleTimer = null;
      this.scheduler.trigger();
    }, this.scrollIdleMs) as unknown as number;
  }

  getPageLayout(index0: number): { width: number; height: number } {
    const page = this.pages[index0];
    if (page?.wPx && page?.hPx) {
      return { width: page.wPx, height: page.hPx };
    }

    // Use average dimensions from already-sized pages as fallback
    let totalWidth = 0;
    let totalHeight = 0;
    let count = 0;
    for (const p of this.pages) {
      if (p.wPx && p.hPx) {
        totalWidth += p.wPx;
        totalHeight += p.hPx;
        count++;
      }
    }

    if (count > 0) {
      return {
        width: Math.floor(totalWidth / count),
        height: Math.floor(totalHeight / count),
      };
    }

    // Final fallback: standard US Letter at current PPI
    return {
      width: Math.floor((DEFAULT_PAGE_PT.w * this.ppi) / 72),
      height: Math.floor((DEFAULT_PAGE_PT.h * this.ppi) / 72),
    };
  }

  setCurrentPage(pageNumber: number) {
    const index0 = Math.max(0, Math.min(this.pageCount - 1, pageNumber - 1));
    this.setCurrentPageIndex(index0);
  }

  updateFromUrl(url: URL) {
    const page = Number(url.searchParams.get("page") ?? 0);
    if (page > 0) {
      this.setCurrentPage(page);
    }
    const ppi = Number(url.searchParams.get("ppi") ?? 0);
    if (ppi > 0) {
      this.setPpi(ppi);
    }
    const position = Number(url.searchParams.get("position") ?? 0);
    if (position >= 0 && position <= 1) {
      this.currentPosition = position;
    }
  }

  private lastUrlState: { page: number; ppi: number; position: string } | null =
    null;

  writeUrl() {
    if (typeof window === "undefined") return;

    const positionStr = this.currentPosition.toFixed(3);
    const newState = {
      page: this.currentPage,
      ppi: this.ppi,
      position: positionStr,
    };

    // Skip if nothing changed
    if (
      this.lastUrlState &&
      this.lastUrlState.page === newState.page &&
      this.lastUrlState.ppi === newState.ppi &&
      this.lastUrlState.position === newState.position
    ) {
      return;
    }

    this.lastUrlState = newState;
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(newState.page));
    url.searchParams.set("ppi", String(newState.ppi));
    url.searchParams.set("position", positionStr);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  setPosition(position: number) {
    const newPos = Math.max(0, Math.min(1, position));
    this.currentPosition = newPos;
    this.writeUrl();
  }

  async requestPageSize(index0: number): Promise<void> {
    if (index0 < 0 || index0 >= this.pageCount) return;
    await this.ensureSize(index0);
  }

  dispose() {
    if (this.scrollIdleTimer !== null) {
      window.clearTimeout(this.scrollIdleTimer);
      this.scrollIdleTimer = null;
    }
    this.disposeDocument();
    runInAction(() => {
      this.pdfBytes = null;
      this.pageCount = 0;
      this.pages = [];
      this.visibleSet = new Set();
      this.currentBookId = null;
      this.currentPageIndex = 0;
      this.canvasBytes = 0;
      this.isLoading = false;
    });
  }

  private setCurrentPageIndex(index0: number) {
    if (index0 === this.currentPageIndex) {
      return;
    }
    this.currentPageIndex = index0;
    this.writeUrl();
  }

  private async performRenderCycle() {
    if (!this.doc) return;
    const visible = [...this.visibleSet].sort((a, b) => a - b);
    const order = this.pickRenderOrder(visible);
    for (const index0 of order) {
      if (!this.doc) return;
      await this.ensureSize(index0);
      await this.renderPage(index0);
      this.cache.enforce(this.visibleSet, this.pageCount);
    }
  }

  private pickRenderOrder(visible: number[]): number[] {
    if (!this.pageCount) return [];
    if (visible.length === 0) {
      return [Math.min(this.currentPageIndex, this.pageCount - 1)];
    }
    // Only render visible pages to minimize memory usage
    return [...visible].sort((a, b) => a - b);
  }

  private async ensureSize(index0: number) {
    const page = this.pages[index0];
    if (!this.doc || !page || page.wPt || page.status === "error") return;
    page.status = "sizing";
    try {
      const { wPt, hPt } = await this.doc.getPageSize(index0);
      runInAction(() => {
        page.wPt = wPt;
        page.hPt = hPt;
        page.setSizeFromPt(this.ppi);
        page.status = "ready";
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      runInAction(() => {
        page.status = "error";
        page.error = message;
      });
    }
  }

  private async renderPage(index0: number) {
    const page = this.pages[index0];
    if (!this.doc || !page) return;
    if (page.status === "rendered" && page.canvas) {
      page.touch();
      return;
    }
    if (page.status === "rendering" || page.status === "error") return;

    if (!page.wPx || !page.hPx) {
      await this.ensureSize(index0);
      if (!page.wPx || !page.hPx) return;
    }

    let handle: Awaited<ReturnType<DocumentHandle["loadPage"]>> | null = null;
    runInAction(() => {
      page.status = "rendering";
    });
    try {
      handle = await this.doc.loadPage(index0);
      const canvas = page.ensureCanvas();
      await handle.renderToCanvas(canvas, this.ppi);
      runInAction(() => {
        this.cache.noteAttach(page, canvas);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      runInAction(() => {
        page.status = "error";
        page.error = message;
      });
      if (page.canvas) {
        this.cache.noteDetach(page);
      }
    } finally {
      handle?.destroy();
    }
  }

  private disposeDocument() {
    for (const page of this.pages) {
      if (page.canvas) {
        this.cache.noteDetach(page);
      }
    }
    this.doc?.destroy();
    this.doc = null;
    this.engine = null;
  }
}
