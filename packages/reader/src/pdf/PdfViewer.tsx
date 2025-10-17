import { observer } from "mobx-react-lite";
import type React from "react";
import { useEffect, useRef, memo, useCallback } from "react";
import type { PdfReaderStore } from "../stores/PdfReaderStore";

interface PdfViewerProps {
  store: PdfReaderStore;
}

class PDFScrollViewer {
  pdfDoc: any = null;
  totalPages = 0;
  scale = 1.0;
  currentPage = 1;

  // Virtual scrolling management
  renderedPages = new Map<number, any>();
  renderQueue: number[] = [];
  isRendering = false;
  renderTasks = new Map<number, any>(); // Track active render tasks

  // Performance settings
  maxPagesInMemory = 10;
  baseMaxPagesInMemory = 10; // Base value for zoom adjustments
  preloadDistance = "200px";

  // Zoom optimization
  zoomTimeout: number | null = null;
  isZooming = false;
  pendingZoom: number | null = null;
  lowResPages = new Map<number, any>(); // Store low-res versions during zoom
  maxDevicePixelRatio = 2; // Cap DPR for performance

  // DOM elements
  container: HTMLElement | null = null;
  pagesContainer: HTMLElement | null = null;

  // Intersection Observer
  observer: IntersectionObserver | null = null;

  // Debounced scroll handler
  scrollTimeout: number | null = null;

  // Store reference
  store: PdfReaderStore;

  // Track initialization state
  isInitialized = false;
  isDisposing = false;

  // Loading indicator
  loadingIndicator: HTMLDivElement | null = null;
  activeLoadingPages = new Set<number>();

  // Jump detection
  lastScrollPosition = 0;
  lastScrollTime = 0;
  isJumping = false;

  // Debug mode
  debugMode = false;

  constructor(store: PdfReaderStore) {
    this.store = store;
    this.updateMemoryLimitForZoom(store.zoom);
  }

  // Dynamically adjust memory limits based on zoom
  updateMemoryLimitForZoom(zoom: number) {
    // At higher zoom levels, reduce pages in memory since each page uses more memory
    if (zoom <= 1.0) {
      this.maxPagesInMemory = this.baseMaxPagesInMemory;
    } else if (zoom <= 1.5) {
      this.maxPagesInMemory = Math.max(
        6,
        Math.floor(this.baseMaxPagesInMemory / 1.5),
      );
    } else if (zoom <= 2.0) {
      this.maxPagesInMemory = Math.max(
        4,
        Math.floor(this.baseMaxPagesInMemory / 2),
      );
    } else {
      this.maxPagesInMemory = Math.max(
        3,
        Math.floor(this.baseMaxPagesInMemory / 3),
      );
    }
  }

  async init(container: HTMLElement, pagesContainer: HTMLElement) {
    console.log("PDFScrollViewer.init called", {
      hasContainer: !!container,
      hasPagesContainer: !!pagesContainer,
      isInitialized: this.isInitialized,
      isDisposing: this.isDisposing,
    });

    // Prevent multiple initializations
    if (this.isInitialized || this.isDisposing) {
      console.log("Skipping init - already initialized or disposing", {
        isInitialized: this.isInitialized,
        isDisposing: this.isDisposing,
      });
      return;
    }

    this.container = container;
    this.pagesContainer = pagesContainer;

    try {
      // Use the PDF from the store
      this.pdfDoc = this.store.pdf;
      if (!this.pdfDoc) {
        console.log("No PDF document in store");
        return;
      }

      console.log("Initializing PDFScrollViewer", {
        numPages: this.pdfDoc.numPages,
        zoom: this.store.zoom,
      });

      this.isInitialized = true;
      this.totalPages = this.pdfDoc.numPages;
      this.scale = this.store.zoom;

      // Create loading indicator
      this.createLoadingIndicator();

      // Create placeholder elements for all pages
      console.log("Creating page placeholders...");
      await this.createPagePlaceholders();
      console.log("Page placeholders created");

      // Setup Intersection Observer
      this.setupIntersectionObserver();

      // Setup event listeners
      this.setupEventListeners();

      // Initial render of visible pages
      console.log("Calling updateVisiblePages from init");
      this.updateVisiblePages();

      // Force render first page if nothing visible
      const visiblePages = this.getVisiblePageNumbers();
      console.log("Initial visible pages:", visiblePages);
      if (visiblePages.length === 0) {
        console.log("No visible pages detected, force rendering page 1");
        this.queuePageRender(1);
      }

      // Handle initial page from URL
      const urlParams = new URLSearchParams(window.location.search);
      const pageFromUrl = Number.parseInt(urlParams.get("page") || "1", 10);
      if (pageFromUrl > 1 && pageFromUrl <= this.totalPages) {
        setTimeout(() => {
          this.goToPage(pageFromUrl);
        }, 100);
      }
    } catch (error) {
      console.error("Error initializing PDF viewer:", error);
      this.isInitialized = false;
    }
  }

  async createPagePlaceholders() {
    if (!this.pagesContainer || this.isDisposing) return;

    // Clear existing content
    this.pagesContainer.innerHTML = "";

    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
      const pageContainer = document.createElement("div");
      pageContainer.className = "pdf-page-container";
      pageContainer.dataset.pageNum = String(pageNum);
      pageContainer.style.marginBottom = "16px";
      pageContainer.style.backgroundColor = "white";
      pageContainer.style.boxShadow = "0 1px 2px 0 rgba(0, 0, 0, 0.05)";
      pageContainer.style.position = "relative";
      pageContainer.style.margin = "0 auto 16px auto"; // Center horizontally

      // Create canvas element
      const canvas = document.createElement("canvas");
      canvas.className = "pdf-page-canvas";
      canvas.style.display = "none";
      canvas.dataset.pageNum = String(pageNum); // Add page num to canvas

      // Create loading placeholder
      const placeholder = document.createElement("div");
      placeholder.className = "page-placeholder";
      placeholder.textContent = `Page ${pageNum}`;
      placeholder.style.display = "flex";
      placeholder.style.justifyContent = "center";
      placeholder.style.alignItems = "center";
      placeholder.style.width = "100%";
      placeholder.style.height = "100%";
      placeholder.style.backgroundColor = "white";
      placeholder.style.color = "#9ca3af";
      placeholder.style.fontSize = "14px";
      placeholder.style.position = "absolute";
      placeholder.style.top = "0";
      placeholder.style.left = "0";

      pageContainer.appendChild(placeholder);
      pageContainer.appendChild(canvas);

      // Create debug overlay with page number (only in debug mode)
      if (this.debugMode) {
        const debugOverlay = document.createElement("div");
        debugOverlay.className = "pdf-page-debug-overlay";
        debugOverlay.dataset.pageNum = String(pageNum);
        debugOverlay.innerHTML = `
          <div>Page ${pageNum}</div>
          <div style="font-size: 10px; font-weight: normal; margin-top: 2px;">Not rendered</div>
        `;
        debugOverlay.style.cssText = `
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          z-index: 100;
          pointer-events: none;
          user-select: none;
        `;
        pageContainer.appendChild(debugOverlay);
      }

      // Get page dimensions to set correct placeholder height
      if (this.pdfDoc && !this.isDisposing) {
        try {
          const page = await this.pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: this.scale });
          pageContainer.style.height = `${viewport.height}px`;
          pageContainer.style.width = `${viewport.width}px`;
        } catch (error) {
          // Set default size if page fetch fails
          pageContainer.style.height = "800px";
          pageContainer.style.width = "600px";
        }
      }

      this.pagesContainer.appendChild(pageContainer);
    }
  }

  setupIntersectionObserver() {
    if (this.isDisposing) return;

    const options = {
      root: this.container,
      rootMargin: this.preloadDistance,
      threshold: 0.01,
    };

    this.observer = new IntersectionObserver((entries) => {
      if (this.isDisposing) return;

      // Skip processing during jumps or zooming to avoid queuing intermediate pages
      if (this.isJumping || this.isZooming) return;

      for (const entry of entries) {
        const pageNum = Number.parseInt(
          entry.target.getAttribute("data-page-num") || "0",
        );

        if (entry.isIntersecting) {
          this.queuePageRender(pageNum);
        } else {
          this.considerPageUnload(pageNum);
        }
      }
    }, options);

    // Start observing all page containers
    const containers = document.querySelectorAll(".pdf-page-container");
    for (const container of containers) {
      this.observer?.observe(container);
    }
  }

  createLoadingIndicator() {
    // Create the loading indicator element
    this.loadingIndicator = document.createElement("div");
    this.loadingIndicator.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 1000;
      display: none;
      pointer-events: none;
      transition: opacity 0.2s ease;
    `;

    // Add to container
    if (this.container) {
      this.container.appendChild(this.loadingIndicator);
    }
  }

  updateLoadingIndicator() {
    if (!this.loadingIndicator) return;

    const loadingCount = this.activeLoadingPages.size;

    if (loadingCount > 0) {
      // Show indicator with count
      const pages = Array.from(this.activeLoadingPages).sort((a, b) => a - b);
      let text = "";

      if (pages.length === 1) {
        text = `Loading page ${pages[0]}...`;
      } else if (pages.length <= 3) {
        text = `Loading pages ${pages.join(", ")}...`;
      } else {
        const min = Math.min(...pages);
        const max = Math.max(...pages);
        text = `Loading ${pages.length} pages (${min}-${max})...`;
      }

      this.loadingIndicator.textContent = text;
      this.loadingIndicator.style.display = "block";
      this.loadingIndicator.style.opacity = "1";
    } else {
      // Hide indicator
      this.loadingIndicator.style.opacity = "0";
      setTimeout(() => {
        if (this.loadingIndicator && this.activeLoadingPages.size === 0) {
          this.loadingIndicator.style.display = "none";
        }
      }, 200);
    }
  }

  queuePageRender(pageNum: number, forceQueue = false) {
    if (
      this.isDisposing ||
      !pageNum ||
      pageNum < 1 ||
      pageNum > this.totalPages
    )
      return;

    // Skip queuing during jumps unless forced
    if (this.isJumping && !forceQueue) return;

    // Check if already rendered
    if (this.renderedPages.has(pageNum)) {
      const pageInfo = this.renderedPages.get(pageNum);
      if (pageInfo?.rendered) {
        return;
      }
    }

    // Check if already in queue
    if (!this.renderQueue.includes(pageNum)) {
      // Add to active loading pages
      this.activeLoadingPages.add(pageNum);
      this.updateLoadingIndicator();

      // Update debug overlay to show loading (only in debug mode)
      if (this.debugMode) {
        const debugOverlay = document.querySelector(
          `.pdf-page-debug-overlay[data-page-num="${pageNum}"]`,
        ) as HTMLElement;
        if (debugOverlay) {
          debugOverlay.innerHTML = `
            <div>Page ${pageNum}</div>
            <div style="font-size: 10px; font-weight: normal; margin-top: 2px; color: #fbbf24;">Loading...</div>
          `;
        }
      }

      this.renderQueue.push(pageNum);
      this.renderQueue.sort((a, b) => a - b);
      this.processRenderQueue();
    }
  }

  async processRenderQueue() {
    if (this.isRendering || this.renderQueue.length === 0 || this.isDisposing) {
      return;
    }

    this.isRendering = true;
    const pageNum = this.renderQueue.shift();
    if (!pageNum) return;

    try {
      await this.renderPage(pageNum);
    } catch (error) {
      console.error(`Error rendering page ${pageNum}:`, error);
    } finally {
      this.isRendering = false;
    }

    // Continue processing queue
    if (this.renderQueue.length > 0 && !this.isDisposing) {
      requestAnimationFrame(() => this.processRenderQueue());
    }
  }

  async renderPage(pageNum: number) {
    if (this.isDisposing || !this.pdfDoc) return;

    // Cancel any existing render task for this page
    const existingTask = this.renderTasks.get(pageNum);
    if (existingTask) {
      try {
        existingTask.cancel();
      } catch (e) {
        // Ignore cancellation errors
      }
      this.renderTasks.delete(pageNum);
    }

    const pageContainer = document.querySelector(
      `[data-page-num="${pageNum}"]`,
    );
    if (!pageContainer) return;

    const canvas = pageContainer.querySelector(
      `.pdf-page-canvas[data-page-num="${pageNum}"]`,
    ) as HTMLCanvasElement;
    if (!canvas) return;

    // Check if already rendering
    if (canvas.dataset.rendering === "true") {
      return;
    }

    try {
      canvas.dataset.rendering = "true";

      // Reset canvas to ensure clean slate
      const existingContext = canvas.getContext("2d");
      if (existingContext) {
        existingContext.clearRect(0, 0, canvas.width, canvas.height);
      }

      // Clear style dimensions to prevent stale values
      canvas.style.width = "";
      canvas.style.height = "";

      const page = await this.pdfDoc.getPage(pageNum);
      // Check again after async operation
      if (this.isDisposing || !this.pdfDoc) {
        canvas.dataset.rendering = "false";
        return;
      }

      // Optimize DPR for higher zoom levels to reduce memory usage
      let effectivePixelRatio = window.devicePixelRatio || 1;
      if (this.scale > 1.5) {
        // Cap pixel ratio at higher zoom levels
        effectivePixelRatio = Math.min(
          effectivePixelRatio,
          this.maxDevicePixelRatio,
        );
      }

      // For pages outside immediate viewport, use lower resolution
      const visiblePages = this.getVisiblePageNumbers();
      const isImmediatelyVisible = visiblePages.includes(pageNum);
      if (!isImmediatelyVisible && this.scale > 1.0) {
        effectivePixelRatio = Math.min(1.5, effectivePixelRatio);
      }

      const viewport = page.getViewport({
        scale: this.scale * effectivePixelRatio,
      });

      const context = canvas.getContext("2d");
      if (!context) return;

      // Set canvas dimensions
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      // Use effectivePixelRatio to match the viewport scale
      canvas.style.width = `${viewport.width / effectivePixelRatio}px`;
      canvas.style.height = `${viewport.height / effectivePixelRatio}px`;

      // Hide placeholder
      const placeholder = pageContainer.querySelector(
        ".page-placeholder",
      ) as HTMLElement;
      if (placeholder) {
        placeholder.style.display = "none";
      }
      canvas.style.display = "block";

      // Render PDF page
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      this.renderTasks.set(pageNum, renderTask);

      await renderTask.promise;

      console.log(`Page ${pageNum} render completed successfully`);

      // Store render info with scale information
      this.renderedPages.set(pageNum, {
        canvas: canvas,
        context: context,
        rendered: true,
        page: page,
        timestamp: Date.now(),
        scale: this.scale,
      });

      this.renderTasks.delete(pageNum);
      this.enforceMemoryLimit();

      // Remove from loading pages and update indicator
      this.activeLoadingPages.delete(pageNum);
      this.updateLoadingIndicator();

      // Update debug overlay (only in debug mode)
      if (this.debugMode) {
        const debugOverlay = document.querySelector(
          `.pdf-page-debug-overlay[data-page-num="${pageNum}"]`,
        ) as HTMLElement;
        if (debugOverlay) {
          debugOverlay.innerHTML = `
            <div>Page ${pageNum}</div>
            <div style="font-size: 10px; font-weight: normal; margin-top: 2px; color: #4ade80;">Rendered</div>
          `;
        }
      }
    } catch (error: any) {
      // Ignore render cancelled errors
      if (error?.name !== "RenderingCancelledException") {
        console.error(`Failed to render page ${pageNum}:`, error);
      }
      // Remove from loading pages even on error
      this.activeLoadingPages.delete(pageNum);
      this.updateLoadingIndicator();
    } finally {
      if (canvas) {
        canvas.dataset.rendering = "false";
      }
    }
  }

  considerPageUnload(pageNum: number) {
    if (this.isDisposing) return;

    const visiblePages = this.getVisiblePageNumbers();
    const buffer = 2;

    const shouldKeep = visiblePages.some(
      (visible) => Math.abs(visible - pageNum) <= buffer,
    );

    if (!shouldKeep && this.renderedPages.has(pageNum)) {
      setTimeout(() => {
        if (this.isDisposing) return;

        const stillVisible = this.getVisiblePageNumbers().some(
          (visible) => Math.abs(visible - pageNum) <= buffer,
        );

        if (!stillVisible) {
          this.unloadPage(pageNum);
        }
      }, 1000);
    }
  }

  unloadPage(pageNum: number) {
    if (this.isDisposing) return;

    // Cancel any active render task
    const renderTask = this.renderTasks.get(pageNum);
    if (renderTask) {
      try {
        renderTask.cancel();
      } catch (e) {
        // Ignore cancellation errors
      }
      this.renderTasks.delete(pageNum);
    }

    const pageInfo = this.renderedPages.get(pageNum);
    if (!pageInfo) return;

    const { canvas, context, page } = pageInfo;

    // Clear canvas
    if (context && canvas) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.display = "none";
      canvas.dataset.rendering = "false";
    }

    // Show placeholder
    const pageContainer = document.querySelector(
      `[data-page-num="${pageNum}"]`,
    );
    const placeholder = pageContainer?.querySelector(
      ".page-placeholder",
    ) as HTMLElement;
    if (placeholder) {
      placeholder.style.display = "flex";
    }

    // Cleanup PDF.js page object
    if (page?.cleanup) {
      page.cleanup();
    }

    this.renderedPages.delete(pageNum);

    // Update debug overlay (only in debug mode)
    if (this.debugMode) {
      const debugOverlay = document.querySelector(
        `.pdf-page-debug-overlay[data-page-num="${pageNum}"]`,
      ) as HTMLElement;
      if (debugOverlay) {
        debugOverlay.innerHTML = `
          <div>Page ${pageNum}</div>
          <div style="font-size: 10px; font-weight: normal; margin-top: 2px;">Not rendered</div>
        `;
      }
    }
  }

  enforceMemoryLimit() {
    if (this.renderedPages.size <= this.maxPagesInMemory || this.isDisposing) {
      return;
    }

    const visiblePages = new Set(this.getVisiblePageNumbers());
    const sortedPages = Array.from(this.renderedPages.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp,
    );

    for (const [pageNum] of sortedPages) {
      if (this.renderedPages.size <= this.maxPagesInMemory) {
        break;
      }

      if (!visiblePages.has(pageNum)) {
        this.unloadPage(pageNum);
      }
    }
  }

  getVisiblePageNumbers(): number[] {
    const visiblePages: number[] = [];
    if (!this.container || this.isDisposing) return visiblePages;

    const containers = document.querySelectorAll(".pdf-page-container");
    const containerRect = this.container.getBoundingClientRect();

    console.log("getVisiblePageNumbers", {
      containersCount: containers.length,
      containerRect,
      containerScrollTop: this.container.scrollTop,
    });

    for (const container of containers) {
      const rect = container.getBoundingClientRect();
      const pageNum = Number.parseInt(
        container.getAttribute("data-page-num") || "0",
      );
      const isVisible =
        rect.bottom >= containerRect.top && rect.top <= containerRect.bottom;

      if (pageNum <= 3) {
        // Log first 3 pages for debugging
        console.log(`Page ${pageNum} visibility:`, {
          rect,
          isVisible,
          containerTop: containerRect.top,
          containerBottom: containerRect.bottom,
        });
      }

      if (isVisible) {
        visiblePages.push(pageNum);
      }
    }

    console.log("Visible pages:", visiblePages);
    return visiblePages;
  }

  updateVisiblePages() {
    if (this.isDisposing) return;

    const visiblePages = this.getVisiblePageNumbers();
    if (visiblePages.length > 0 && this.container) {
      const targetPosition =
        this.container.getBoundingClientRect().top +
        this.container.clientHeight * 0.1;

      for (const pageNum of visiblePages) {
        const pageContainer = document.querySelector(
          `[data-page-num="${pageNum}"]`,
        );
        if (pageContainer) {
          const rect = pageContainer.getBoundingClientRect();
          if (rect.top <= targetPosition && rect.bottom > targetPosition) {
            if (this.currentPage !== pageNum) {
              this.currentPage = pageNum;
              this.store.setCurrentPage(pageNum);
            }
            break;
          }
        }
      }
    }
  }

  handleScrollJump() {
    if (this.isDisposing) return;

    console.log("Scroll jump detected, optimizing page loading...");

    // Get visible pages and a buffer around them
    const visiblePages = new Set(this.getVisiblePageNumbers());
    const visibleArray = Array.from(visiblePages).sort((a, b) => a - b);

    // Create a set of pages we want to keep (visible + 2 buffer)
    const pagesToKeep = new Set(visiblePages);
    if (visibleArray.length > 0) {
      const minVisible = Math.min(...visibleArray);
      const maxVisible = Math.max(...visibleArray);

      // Add buffer pages
      for (let i = 1; i <= 2; i++) {
        if (minVisible - i >= 1) pagesToKeep.add(minVisible - i);
        if (maxVisible + i <= this.totalPages) pagesToKeep.add(maxVisible + i);
      }
    }

    // Only cancel renders for pages far from visible area
    for (const [pageNum, task] of this.renderTasks) {
      if (!pagesToKeep.has(pageNum)) {
        try {
          task.cancel();
        } catch (e) {
          // Ignore cancellation errors
        }
        this.renderTasks.delete(pageNum);
      }
    }

    // Clear the render queue and rebuild with priority
    this.renderQueue = [];

    // Remove far pages from active loading
    for (const pageNum of this.activeLoadingPages) {
      if (!pagesToKeep.has(pageNum)) {
        this.activeLoadingPages.delete(pageNum);
      }
    }
    this.updateLoadingIndicator();

    // Get the middle visible page
    const middlePage = visibleArray[Math.floor(visibleArray.length / 2)];

    if (middlePage) {
      // Priority 1: Render the middle visible page first
      this.queuePageRender(middlePage, true);

      // Priority 2: Render other visible pages
      for (const pageNum of visibleArray) {
        if (pageNum !== middlePage) {
          this.queuePageRender(pageNum, true);
        }
      }

      // Priority 3: Render adjacent pages (2 before and 2 after the visible range)
      const minVisible = Math.min(...visibleArray);
      const maxVisible = Math.max(...visibleArray);

      // Add 2 pages before
      for (let i = 1; i <= 2; i++) {
        const pageNum = minVisible - i;
        if (pageNum >= 1) {
          this.queuePageRender(pageNum, true);
        }
      }

      // Add 2 pages after
      for (let i = 1; i <= 2; i++) {
        const pageNum = maxVisible + i;
        if (pageNum <= this.totalPages) {
          this.queuePageRender(pageNum, true);
        }
      }
    }

    // Force process the queue immediately for the middle page
    if (!this.isRendering) {
      this.processRenderQueue();
    }
  }

  setupEventListeners() {
    if (!this.container || this.isDisposing) return;

    const handleScroll = () => {
      const now = Date.now();
      const currentScroll = this.container?.scrollTop || 0;
      const scrollDelta = Math.abs(currentScroll - this.lastScrollPosition);
      const timeDelta = now - this.lastScrollTime;

      // Detect jump: very large scroll distance or large distance in extremely short time
      // Use conservative thresholds to avoid triggering on fast scrolling or smooth mice
      // Only trigger on actual jumps (page input, ToC clicks, etc.)
      const isJump =
        scrollDelta > 5000 || (scrollDelta > 2000 && timeDelta < 16);

      if (isJump && !this.isJumping) {
        this.isJumping = true;
        this.handleScrollJump();

        // Set a maximum timeout for jumping state to prevent stuck state
        setTimeout(() => {
          if (this.isJumping) {
            console.log("Force ending jump state after timeout");
            this.isJumping = false;
          }
        }, 500);
      }

      this.lastScrollPosition = currentScroll;
      this.lastScrollTime = now;

      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
      }
      this.scrollTimeout = window.setTimeout(() => {
        // Reset jumping state
        this.isJumping = false;
        this.updateVisiblePages();

        // After a jump/drag, ensure visible pages are queued for rendering
        const visiblePages = this.getVisiblePageNumbers();
        for (const pageNum of visiblePages) {
          if (
            !this.renderedPages.has(pageNum) ||
            !this.renderedPages.get(pageNum)?.rendered
          ) {
            this.queuePageRender(pageNum, true);
          }
        }
      }, 100);
    };

    this.container.addEventListener("scroll", handleScroll, { passive: true });
  }

  async applyZoom() {
    if (this.isDisposing || !this.pdfDoc) return;

    // Progressive zoom rendering - don't clear everything immediately
    this.isZooming = true;

    // Update memory limits for new zoom level
    this.updateMemoryLimitForZoom(this.scale);

    // Cancel only non-visible page renders
    const visiblePages = new Set(this.getVisiblePageNumbers());
    for (const [pageNum, task] of this.renderTasks) {
      if (!visiblePages.has(pageNum)) {
        try {
          task.cancel();
        } catch (e) {
          // Ignore cancellation errors
        }
        this.renderTasks.delete(pageNum);
      }
    }

    // Store current rendered pages as low-res while we re-render
    // But also clear non-visible pages completely
    for (const [pageNum, pageInfo] of this.renderedPages) {
      if (visiblePages.has(pageNum)) {
        // Keep visible pages for visual continuity
        this.lowResPages.set(pageNum, pageInfo);
      } else {
        // Clear non-visible pages completely
        this.unloadPage(pageNum);
      }
    }

    // IMPORTANT: Clear ALL rendered pages from the map so they will be re-rendered at new zoom
    // We keep the visible page canvases displayed via lowResPages for visual continuity
    this.renderedPages.clear();

    // Clear render queue and active loading
    this.renderQueue = [];
    this.activeLoadingPages.clear();
    this.updateLoadingIndicator();

    // First, apply CSS transform for immediate visual feedback
    const containers = document.querySelectorAll(".pdf-page-container");
    for (const container of containers) {
      const pageNum = Number.parseInt(
        container.getAttribute("data-page-num") || "0",
      );
      if (this.lowResPages.has(pageNum)) {
        const htmlContainer = container as HTMLElement;
        htmlContainer.style.transition = "transform 0.2s ease";
        // Temporarily scale existing content while re-rendering
        const scaleRatio =
          this.scale / (this.lowResPages.get(pageNum).scale || 1);
        if (Math.abs(scaleRatio - 1) > 0.1) {
          htmlContainer.style.transform = `scale(${scaleRatio})`;
          htmlContainer.style.transformOrigin = "top left";
        }
      }
    }

    // Update page container sizes progressively
    const updateContainerSizes = async () => {
      const visiblePagesArray = Array.from(visiblePages).sort((a, b) => a - b);

      // Update visible pages first
      for (const pageNum of visiblePagesArray) {
        if (this.isDisposing) break;
        await this.updatePageContainerSize(pageNum);
      }

      // Then update remaining pages in background
      for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
        if (this.isDisposing || visiblePages.has(pageNum)) continue;
        await this.updatePageContainerSize(pageNum);

        // Yield to browser every 10 pages
        if (pageNum % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    };

    // Start updating container sizes
    updateContainerSizes().then(() => {
      // Reset transforms after containers are sized
      for (const container of containers) {
        const htmlContainer = container as HTMLElement;
        htmlContainer.style.transform = "";
        htmlContainer.style.transition = "";
      }
    });

    // Re-render visible pages with priority
    this.updateVisiblePages();
    const visiblePagesList = this.getVisiblePageNumbers();

    // Render center page first for immediate feedback
    const centerPage =
      visiblePagesList[Math.floor(visiblePagesList.length / 2)];
    if (centerPage) {
      this.queuePageRender(centerPage);
    }

    // Then render other visible pages
    for (const pageNum of visiblePagesList) {
      if (pageNum !== centerPage) {
        this.queuePageRender(pageNum);
      }
    }

    // Clear low-res cache after a delay
    setTimeout(() => {
      this.lowResPages.clear();
      this.isZooming = false;
    }, 1000);
  }

  async updatePageContainerSize(pageNum: number) {
    if (!this.pdfDoc || this.isDisposing) return;

    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: this.scale });

      const pageContainer = document.querySelector(
        `[data-page-num="${pageNum}"]`,
      ) as HTMLElement;
      if (pageContainer) {
        pageContainer.style.height = `${viewport.height}px`;
        pageContainer.style.width = `${viewport.width}px`;
      }
    } catch (error) {
      // Ignore errors if PDF is being disposed
      if (!this.isDisposing) {
        console.error(`Error updating page ${pageNum} container size:`, error);
      }
    }
  }

  goToPage(pageNum: number) {
    if (this.isDisposing) return;

    const targetPage = Math.max(1, Math.min(this.totalPages, pageNum));
    const pageContainer = document.querySelector(
      `[data-page-num="${targetPage}"]`,
    );
    if (pageContainer && this.container) {
      // Mark as jumping to optimize loading
      this.isJumping = true;

      pageContainer.scrollIntoView({ behavior: "instant", block: "start" });
      this.container.scrollTop -= this.container.clientHeight * 0.1;
      this.currentPage = targetPage;
      this.store.setCurrentPage(targetPage);

      // Trigger jump optimization immediately
      setTimeout(() => {
        this.handleScrollJump();
      }, 50);
    }
  }

  dispose() {
    this.isDisposing = true;
    this.isInitialized = false;

    // Cancel all active render tasks
    for (const task of this.renderTasks.values()) {
      try {
        task.cancel();
      } catch (e) {
        // Ignore cancellation errors
      }
    }
    this.renderTasks.clear();

    // Clear render queue
    this.renderQueue = [];
    this.isRendering = false;

    // Disconnect observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Clear timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    // Cleanup rendered pages
    for (const pageInfo of this.renderedPages.values()) {
      if (pageInfo.page?.cleanup) {
        pageInfo.page.cleanup();
      }
    }
    this.renderedPages.clear();

    // Clear DOM
    if (this.pagesContainer) {
      this.pagesContainer.innerHTML = "";
    }

    // Remove loading indicator
    if (this.loadingIndicator && this.loadingIndicator.parentNode) {
      this.loadingIndicator.parentNode.removeChild(this.loadingIndicator);
      this.loadingIndicator = null;
    }

    // Clear active loading pages
    this.activeLoadingPages.clear();

    this.container = null;
    this.pagesContainer = null;
  }
}

// Singleton instance to persist across React re-renders
let viewerInstance: PDFScrollViewer | null = null;

// Inner component that doesn't re-render - just provides DOM containers
interface PdfContainerProps {
  onContainerReady: (container: HTMLDivElement, host: HTMLDivElement) => void;
}

const PdfContainer = memo(({ onContainerReady }: PdfContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  console.log("PdfContainer render (should be minimal)");

  useEffect(() => {
    console.log("PdfContainer useEffect", {
      hasContainerRef: !!containerRef.current,
      hasHostRef: !!hostRef.current,
      hasCallback: !!onContainerReady,
    });
    if (containerRef.current && hostRef.current) {
      console.log("Calling onContainerReady callback");
      onContainerReady(containerRef.current, hostRef.current);
    }
  }, [onContainerReady]);

  return (
    <div
      ref={containerRef}
      className="pdf-scroll-container"
      style={{
        height: "100vh",
        overflowY: "auto",
        backgroundColor: "#f3f4f6",
      }}
    >
      <div
        ref={hostRef}
        className="pdf-pages-container"
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "32px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      />
    </div>
  );
});

PdfContainer.displayName = "PdfContainer";

// Outer component that observes store changes
export const PdfViewer = observer(({ store }: PdfViewerProps) => {
  const initRef = useRef(false);
  const pageInputRef = useRef<HTMLInputElement>(null);
  console.log("PdfViewer render (observer) - currentPage:", store.currentPage);

  // Setup container callback
  const containerCallback = useCallback(
    (container: HTMLDivElement, host: HTMLDivElement) => {
      console.log("Container callback function executing", {
        hasContainer: !!container,
        hasHost: !!host,
        hasStore: !!store,
        hasPDF: !!store.pdf,
      });

      // Create viewer instance if needed
      if (!viewerInstance || viewerInstance.store !== store) {
        if (viewerInstance) {
          console.log("Disposing old viewer instance");
          viewerInstance.dispose();
        }
        console.log("Creating new PDFScrollViewer instance");
        viewerInstance = new PDFScrollViewer(store);
      }

      // Initialize when PDF is ready
      console.log("Container callback - checking PDF", {
        hasPDF: !!store.pdf,
        initRef: initRef.current,
        pageCount: store.pageCount,
      });
      if (store.pdf && !initRef.current) {
        initRef.current = true;
        console.log("Initializing PDF viewer with", store.pageCount, "pages");
        viewerInstance.init(container, host);
      }
    },
    [store, store.pdf],
  );

  // Reset init flag when PDF changes
  useEffect(() => {
    initRef.current = false;
  }, [store.pdf]);

  // Apply URL params on mount
  useEffect(() => {
    store.updateFromUrl(new URL(window.location.href));
  }, [store]);

  // Handle zoom changes with debouncing
  useEffect(() => {
    if (
      viewerInstance &&
      viewerInstance.isInitialized &&
      viewerInstance.scale !== store.zoom
    ) {
      viewerInstance.scale = store.zoom;

      // Debounce zoom to prevent rapid re-renders
      if (viewerInstance.zoomTimeout) {
        clearTimeout(viewerInstance.zoomTimeout);
      }

      // Apply immediate CSS transform for feedback
      viewerInstance.pendingZoom = store.zoom;

      viewerInstance.zoomTimeout = window.setTimeout(() => {
        if (viewerInstance) {
          viewerInstance.applyZoom();
          viewerInstance.zoomTimeout = null;
          viewerInstance.pendingZoom = null;
        }
      }, 150); // 150ms debounce
    }
  }, [store.zoom]);

  // Update page input when current page changes
  useEffect(() => {
    if (
      pageInputRef.current &&
      !document.activeElement?.isSameNode(pageInputRef.current)
    ) {
      pageInputRef.current.value = String(store.currentPage);
    }
  }, [store.currentPage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (viewerInstance) {
        viewerInstance.dispose();
        viewerInstance = null;
        initRef.current = false;
      }
    };
  }, []);

  if (store.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading PDF...</div>
      </div>
    );
  }

  if (store.error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">Error: {store.error}</div>
      </div>
    );
  }

  const handleZoomIn = () => {
    if (viewerInstance) {
      const newZoom = Math.min(viewerInstance.scale * 1.2, 5);
      store.setZoom(newZoom);
      // The useEffect will handle the debounced applyZoom
    }
  };

  const handleZoomOut = () => {
    if (viewerInstance) {
      const newZoom = Math.max(viewerInstance.scale / 1.2, 0.25);
      store.setZoom(newZoom);
      // The useEffect will handle the debounced applyZoom
    }
  };

  const handleZoomReset = async () => {
    await store.computeInitialZoom();
    // The useEffect will handle the debounced applyZoom
  };

  const handlePageInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && viewerInstance) {
      const value = (e.target as HTMLInputElement).value.trim();
      const pageNum = Number.parseInt(value, 10);
      if (!isNaN(pageNum)) {
        viewerInstance.goToPage(pageNum);
      }
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Zoom controls */}
      <div className="fixed top-4 right-4 z-10 bg-white rounded-lg shadow-md p-2 flex gap-2">
        <button
          type="button"
          onClick={handleZoomOut}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          title="Zoom Out"
        >
          −
        </button>
        <button
          type="button"
          onClick={handleZoomReset}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          title="Fit Width"
        >
          Fit
        </button>
        <button
          type="button"
          onClick={handleZoomIn}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          title="Zoom In"
        >
          +
        </button>
        <span className="px-2 py-1 text-sm text-gray-600">
          {store.zoom > 0 ? Math.round(store.zoom * 100) : 100}%
        </span>
      </div>

      {/* Page indicator with input */}
      {store.pageCount > 0 && (
        <div className="fixed bottom-4 right-4 z-10 bg-white rounded-lg shadow-md px-3 py-2">
          <span className="text-sm text-gray-600 flex items-center gap-1">
            <input
              ref={pageInputRef}
              type="text"
              defaultValue={store.currentPage}
              onKeyDown={handlePageInput}
              onFocus={(e) => e.target.select()}
              className="w-16 px-1 border border-gray-300 rounded text-center"
              placeholder={String(store.currentPage)}
            />
            {" / "}
            {store.pageCount}
          </span>
        </div>
      )}

      {/* PDF container - non-observable component */}
      <PdfContainer onContainerReady={containerCallback} />
    </div>
  );
});

export default PdfViewer;
