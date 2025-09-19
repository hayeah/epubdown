import { makeObservable, observable, action, runInAction } from "mobx";
import type { AppEventSystem } from "../app/context";
import type { BookLibraryStore } from "./BookLibraryStore";

export class PdfReaderStore {
  pdf: any = null;
  pageCount = 0;
  currentBookId: number | null = null;
  zoom = 1.5; // Default zoom for reasonable page width
  currentPage = 1;
  containerWidth = 0;
  isLoading = false;
  error: string | null = null;

  constructor(
    private lib: BookLibraryStore,
    private events: AppEventSystem,
  ) {
    makeObservable(this, {
      pdf: observable.ref,
      pageCount: observable,
      currentBookId: observable,
      zoom: observable,
      currentPage: observable,
      containerWidth: observable,
      isLoading: observable,
      error: observable,
      setZoom: action,
      setCurrentPage: action,
      setContainerWidth: action,
      setError: action,
    });
  }

  async load(bookId: number) {
    try {
      runInAction(() => {
        this.isLoading = true;
        this.error = null;
      });

      const data = await this.lib.loadBookForReading(bookId);
      if (!data) {
        throw new Error("Book not found");
      }

      const buf = await data.blob.arrayBuffer();

      // Lazy load pdf.js
      const pdfjs = await import("pdfjs-dist");

      // Set up worker
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        const workerUrl = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).href;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      }

      const doc = await pdfjs.getDocument({ data: buf }).promise;

      runInAction(() => {
        this.pdf = doc;
        this.pageCount = doc.numPages;
        this.currentBookId = bookId;
        this.isLoading = false;
      });

      // Set a reasonable default zoom
      // PDF pages are typically ~600px wide at scale 1
      // So 1.5x gives us ~900px which fits well in a 1200px container
      if (this.zoom === 1.5) {
        // Already at default, no need to recalculate
      }
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : "Failed to load PDF";
        this.isLoading = false;
      });
    }
  }

  async computeInitialZoom() {
    if (!this.pdf || this.containerWidth === 0) return;

    try {
      const page = await this.pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      // Use the actual container width for calculation
      const availableWidth = Math.min(this.containerWidth, 1200) - 64; // padding and margins
      const scale = availableWidth / viewport.width;

      // Ensure scale is reasonable (between 0.5 and 3)
      const clampedScale = Math.max(0.5, Math.min(3, scale));

      runInAction(() => {
        this.zoom = clampedScale;
      });
    } catch (err) {
      console.error("Failed to compute initial zoom:", err);
      // Fallback to a reasonable default
      runInAction(() => {
        this.zoom = 1.5;
      });
    }
  }

  setZoom(z: number) {
    this.zoom = Math.max(0.25, Math.min(5, z));
    this.writeUrl();
  }

  setCurrentPage(n: number) {
    const clamped = Math.max(1, Math.min(this.pageCount || 1, n));
    if (this.currentPage !== clamped) {
      this.currentPage = clamped;
      this.writeUrl();
    }
  }

  setContainerWidth(width: number) {
    this.containerWidth = width;
  }

  setError(error: string | null) {
    this.error = error;
  }

  updateFromUrl(u: URL) {
    const p = Number(u.searchParams.get("page") || 0);
    const z = Number(u.searchParams.get("zoom") || 0);
    if (p > 0) {
      runInAction(() => {
        this.currentPage = p;
      });
    }
    if (z > 0) {
      runInAction(() => {
        this.zoom = z;
      });
    }
  }

  writeUrl() {
    const u = new URL(window.location.href);
    u.searchParams.set("page", String(this.currentPage));
    u.searchParams.set("zoom", this.zoom.toFixed(2));
    history.replaceState(null, "", u.pathname + u.search + u.hash);
  }

  dispose() {
    if (this.pdf) {
      this.pdf.destroy();
      this.pdf = null;
    }
  }
}
