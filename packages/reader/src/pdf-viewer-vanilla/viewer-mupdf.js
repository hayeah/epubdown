/**
 * Scrollable PDF Viewer with Virtual Rendering using MuPDF.js
 * Uses Intersection Observer API for efficient memory management
 * Only keeps a few pages rendered at a time to optimize performance
 */

// Import MuPDF from the installed package
import * as mupdf from "../../node_modules/mupdf/dist/mupdf.js";

class MuPDFScrollViewer {
  constructor() {
    // Core PDF properties
    this.pdfDoc = null;
    this.totalPages = 0;
    this.scale = 1.6;

    // Virtual scrolling management
    this.renderedPages = new Map(); // Map of pageNum -> {canvas, context, rendered}
    this.renderQueue = [];
    this.isRendering = false;

    // Performance settings
    this.maxPagesInMemory = 5; // Maximum pages to keep rendered
    this.preloadDistance = "200px"; // How far ahead to preload

    // DOM elements
    this.container = document.getElementById("pdf-scroll-container");
    this.pagesContainer = document.getElementById("pdf-pages");
    this.loadingDiv = document.getElementById("loading");
    this.errorDiv = document.getElementById("error");

    // UI elements
    this.currentPageSpan = document.getElementById("current-page");
    this.pageCountSpan = document.getElementById("page-count");
    this.zoomLevelSpan = document.getElementById("zoom-level");
    this.loadedPagesSpan = document.getElementById("loaded-pages");

    // Intersection Observer for lazy loading
    this.observer = null;

    // Debounced scroll handler for current page detection
    this.scrollTimeout = null;

    this.init();
  }

  async init() {
    try {
      this.loadingDiv.textContent = "Loading PDF...";

      // Load the PDF
      const response = await fetch("/sample.pdf");
      const pdfData = await response.arrayBuffer();

      // Open document with MuPDF
      // The Document.openDocument static method handles the data directly
      this.pdfDoc = mupdf.Document.openDocument(
        new Uint8Array(pdfData),
        "application/pdf",
      );
      this.totalPages = this.pdfDoc.countPages();

      // Update UI
      this.pageCountSpan.textContent = this.totalPages;
      this.loadingDiv.style.display = "none";

      // Create placeholder elements for all pages
      await this.createPagePlaceholders();

      // Setup Intersection Observer
      this.setupIntersectionObserver();

      // Setup event listeners
      this.setupEventListeners();

      // Initial render of visible pages
      this.updateVisiblePages();
    } catch (error) {
      this.showError(error);
    }
  }

  async createPagePlaceholders() {
    // Create placeholder divs for all pages
    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
      const pageContainer = document.createElement("div");
      pageContainer.className = "pdf-page-container";
      pageContainer.dataset.pageNum = pageNum;

      // Create canvas element
      const canvas = document.createElement("canvas");
      canvas.className = "pdf-page-canvas";

      // Create page number indicator
      const pageIndicator = document.createElement("div");
      pageIndicator.className = "page-indicator";
      pageIndicator.textContent = `Page ${pageNum}`;

      // Create loading placeholder
      const placeholder = document.createElement("div");
      placeholder.className = "page-placeholder";
      placeholder.textContent = `Loading page ${pageNum}...`;

      pageContainer.appendChild(placeholder);
      pageContainer.appendChild(canvas);
      pageContainer.appendChild(pageIndicator);

      // Get page dimensions to set correct placeholder height
      const page = this.pdfDoc.loadPage(pageNum - 1); // MuPDF uses 0-based indexing
      const bounds = page.getBounds();
      const width = (bounds[2] - bounds[0]) * this.scale;
      const height = (bounds[3] - bounds[1]) * this.scale;

      pageContainer.style.height = `${height}px`;
      pageContainer.style.width = `${width}px`;

      this.pagesContainer.appendChild(pageContainer);

      // Observe this page container
      if (this.observer) {
        this.observer.observe(pageContainer);
      }
    }
  }

  setupIntersectionObserver() {
    const options = {
      root: this.container,
      rootMargin: this.preloadDistance,
      threshold: 0.01,
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const pageNum = Number.parseInt(entry.target.dataset.pageNum);

        if (entry.isIntersecting) {
          // Page is entering viewport - queue for rendering
          this.queuePageRender(pageNum);
        } else {
          // Page is leaving viewport - consider unloading
          this.considerPageUnload(pageNum);
        }
      });
    }, options);

    // Start observing all page containers
    document.querySelectorAll(".pdf-page-container").forEach((container) => {
      this.observer.observe(container);
    });
  }

  queuePageRender(pageNum) {
    // Check if already rendered or in queue
    if (
      this.renderedPages.has(pageNum) &&
      this.renderedPages.get(pageNum).rendered
    ) {
      return;
    }

    if (!this.renderQueue.includes(pageNum)) {
      this.renderQueue.push(pageNum);
      this.renderQueue.sort((a, b) => a - b); // Keep queue sorted
      this.processRenderQueue();
    }
  }

  async processRenderQueue() {
    if (this.isRendering || this.renderQueue.length === 0) {
      return;
    }

    this.isRendering = true;
    const pageNum = this.renderQueue.shift();

    try {
      await this.renderPage(pageNum);
    } catch (error) {
      console.error(`Error rendering page ${pageNum}:`, error);
    }

    this.isRendering = false;

    // Continue processing queue
    if (this.renderQueue.length > 0) {
      this.processRenderQueue();
    }

    this.updateMemoryInfo();
  }

  async renderPage(pageNum) {
    const pageContainer = document.querySelector(
      `[data-page-num="${pageNum}"]`,
    );
    if (!pageContainer) return;

    // Load the page (MuPDF uses 0-based indexing)
    const page = this.pdfDoc.loadPage(pageNum - 1);
    const bounds = page.getBounds();

    // Calculate dimensions with current scale
    const pageWidth = bounds[2] - bounds[0];
    const pageHeight = bounds[3] - bounds[1];
    const scaledWidth = pageWidth * this.scale;
    const scaledHeight = pageHeight * this.scale;

    // Get or create canvas
    const canvas = pageContainer.querySelector(".pdf-page-canvas");
    const context = canvas.getContext("2d");

    // Set canvas dimensions (account for device pixel ratio for crisp rendering)
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = scaledWidth * pixelRatio;
    canvas.height = scaledHeight * pixelRatio;
    canvas.style.width = `${scaledWidth}px`;
    canvas.style.height = `${scaledHeight}px`;

    // Scale context for device pixel ratio
    context.scale(pixelRatio, pixelRatio);

    // Hide placeholder, show canvas
    const placeholder = pageContainer.querySelector(".page-placeholder");
    if (placeholder) {
      placeholder.style.display = "none";
    }
    canvas.style.display = "block";

    // Create transformation matrix for rendering
    const matrix = mupdf.Matrix.scale(this.scale, this.scale);

    try {
      // Render page to pixmap
      const pixmap = page.toPixmap(
        matrix,
        mupdf.ColorSpace.DeviceRGB,
        false, // alpha
      );

      // Convert pixmap to image data
      const samples = pixmap.getPixels();
      const w = pixmap.getWidth();
      const h = pixmap.getHeight();
      const stride = pixmap.getStride();
      const numComponents = pixmap.getNumberOfComponents();

      // Create ImageData
      const imageData = context.createImageData(w, h);
      const data = imageData.data;

      // Copy pixel data (MuPDF uses RGB, canvas needs RGBA)
      if (numComponents === 3) {
        // RGB
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const srcIdx = y * stride + x * 3;
            const dstIdx = (y * w + x) * 4;
            data[dstIdx] = samples[srcIdx]; // R
            data[dstIdx + 1] = samples[srcIdx + 1]; // G
            data[dstIdx + 2] = samples[srcIdx + 2]; // B
            data[dstIdx + 3] = 255; // A
          }
        }
      } else if (numComponents === 4) {
        // RGBA
        for (let i = 0; i < samples.length; i++) {
          data[i] = samples[i];
        }
      }

      // Draw to canvas
      context.putImageData(imageData, 0, 0);

      // Clean up
      pixmap.destroy();
    } catch (error) {
      console.error(`MuPDF rendering error for page ${pageNum}:`, error);
      // Fallback: show error on canvas
      context.fillStyle = "#f0f0f0";
      context.fillRect(0, 0, scaledWidth, scaledHeight);
      context.fillStyle = "#333";
      context.font = "16px sans-serif";
      context.textAlign = "center";
      context.fillText(
        "Error rendering page",
        scaledWidth / 2,
        scaledHeight / 2,
      );
    }

    // Store render info
    this.renderedPages.set(pageNum, {
      canvas: canvas,
      context: context,
      rendered: true,
      page: page,
      timestamp: Date.now(),
    });

    // Clean up old pages if we exceed memory limit
    this.enforceMemoryLimit();
  }

  considerPageUnload(pageNum) {
    // Keep pages that are close to current viewport
    const visiblePages = this.getVisiblePageNumbers();
    const buffer = 2; // Keep 2 pages above and below visible area

    const shouldKeep = visiblePages.some(
      (visible) => Math.abs(visible - pageNum) <= buffer,
    );

    if (!shouldKeep && this.renderedPages.has(pageNum)) {
      // Schedule unload after a delay to avoid thrashing
      setTimeout(() => {
        const stillVisible = this.getVisiblePageNumbers().some(
          (visible) => Math.abs(visible - pageNum) <= buffer,
        );

        if (!stillVisible) {
          this.unloadPage(pageNum);
        }
      }, 1000);
    }
  }

  unloadPage(pageNum) {
    const pageInfo = this.renderedPages.get(pageNum);
    if (!pageInfo) return;

    // Clear canvas
    const { canvas, context, page } = pageInfo;
    context.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = "none";

    // Show placeholder again
    const pageContainer = document.querySelector(
      `[data-page-num="${pageNum}"]`,
    );
    const placeholder = pageContainer?.querySelector(".page-placeholder");
    if (placeholder) {
      placeholder.style.display = "block";
    }

    // Remove from rendered pages
    this.renderedPages.delete(pageNum);

    this.updateMemoryInfo();
  }

  enforceMemoryLimit() {
    if (this.renderedPages.size <= this.maxPagesInMemory) {
      return;
    }

    // Get currently visible pages
    const visiblePages = new Set(this.getVisiblePageNumbers());

    // Sort rendered pages by timestamp (oldest first)
    const sortedPages = Array.from(this.renderedPages.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp,
    );

    // Unload oldest pages that aren't visible
    for (const [pageNum, pageInfo] of sortedPages) {
      if (this.renderedPages.size <= this.maxPagesInMemory) {
        break;
      }

      // Don't unload visible pages
      if (!visiblePages.has(pageNum)) {
        this.unloadPage(pageNum);
      }
    }
  }

  getVisiblePageNumbers() {
    const visiblePages = [];
    const containers = document.querySelectorAll(".pdf-page-container");

    containers.forEach((container) => {
      const rect = container.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();

      // Check if page is in viewport
      if (
        rect.bottom >= containerRect.top &&
        rect.top <= containerRect.bottom
      ) {
        visiblePages.push(Number.parseInt(container.dataset.pageNum));
      }
    });

    return visiblePages;
  }

  updateVisiblePages() {
    const visiblePages = this.getVisiblePageNumbers();
    if (visiblePages.length > 0) {
      this.currentPageSpan.textContent = `${visiblePages[0]}-${visiblePages[visiblePages.length - 1]}`;
    }
  }

  updateMemoryInfo() {
    this.loadedPagesSpan.textContent = `Pages in memory: ${this.renderedPages.size}`;
  }

  setupEventListeners() {
    // Zoom controls
    document
      .getElementById("zoom-in")
      .addEventListener("click", () => this.zoomIn());
    document
      .getElementById("zoom-out")
      .addEventListener("click", () => this.zoomOut());
    document
      .getElementById("zoom-fit")
      .addEventListener("click", () => this.fitWidth());

    // Scroll event for updating current page indicator
    this.container.addEventListener("scroll", () => {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        this.updateVisiblePages();
      }, 100);
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      switch (e.key) {
        case "+":
        case "=":
          this.zoomIn();
          break;
        case "-":
        case "_":
          this.zoomOut();
          break;
        case "0":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.resetZoom();
          }
          break;
      }
    });
  }

  async zoomIn() {
    this.scale = Math.min(this.scale + 0.25, 3);
    await this.applyZoom();
  }

  async zoomOut() {
    this.scale = Math.max(this.scale - 0.25, 0.5);
    await this.applyZoom();
  }

  async resetZoom() {
    this.scale = 1.0;
    await this.applyZoom();
  }

  async fitWidth() {
    const containerWidth = this.container.clientWidth - 40; // Account for padding
    const page = this.pdfDoc.loadPage(0);
    const bounds = page.getBounds();
    const pageWidth = bounds[2] - bounds[0];
    this.scale = containerWidth / pageWidth;
    await this.applyZoom();
  }

  async applyZoom() {
    this.zoomLevelSpan.textContent = `${Math.round(this.scale * 100)}%`;

    // Clear all rendered pages
    this.renderedPages.forEach((_, pageNum) => this.unloadPage(pageNum));
    this.renderQueue = [];

    // Update all page container sizes
    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
      const page = this.pdfDoc.loadPage(pageNum - 1);
      const bounds = page.getBounds();
      const width = (bounds[2] - bounds[0]) * this.scale;
      const height = (bounds[3] - bounds[1]) * this.scale;

      const pageContainer = document.querySelector(
        `[data-page-num="${pageNum}"]`,
      );
      if (pageContainer) {
        pageContainer.style.height = `${height}px`;
        pageContainer.style.width = `${width}px`;

        const canvas = pageContainer.querySelector(".pdf-page-canvas");
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    }

    // Re-render visible pages
    this.updateVisiblePages();
    this.getVisiblePageNumbers().forEach((pageNum) => {
      this.queuePageRender(pageNum);
    });
  }

  showError(error) {
    this.loadingDiv.style.display = "none";
    this.errorDiv.style.display = "block";
    this.errorDiv.innerHTML = `
            <h3>Error loading PDF</h3>
            <p>${error.message}</p>
            <p style="font-size: 0.9em; margin-top: 1em;">
				Make sure you have installed the mupdf package: <code>pnpm add mupdf</code>
			</p>
        `;
    console.error("PDF loading error:", error);
  }
}

// Initialize viewer when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  window.MuPDFScrollViewer = new MuPDFScrollViewer();
});
