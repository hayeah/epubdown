/**
 * Scrollable PDF Viewer with Virtual Rendering using PDFium
 * Uses Intersection Observer API for efficient memory management
 * Only keeps a few pages rendered at a time to optimize performance
 */

class PDFiumScrollViewer {
  constructor() {
    // Core PDF properties
    this.pdfium = null;
    this.pdfDocument = null;
    this.totalPages = 0;
    this.scale = 1.0;
    this.pdfBuffer = null;
    this.pageCache = new Map(); // Cache page objects
    this.api = {}; // Store API function references

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

  async initializePDFium() {
    try {
      // Fetch the WebAssembly binary
      const pdfiumWasm = "https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@1/dist/pdfium.wasm";
      const response = await fetch(pdfiumWasm);
      const wasmBinary = await response.arrayBuffer();

      // Initialize PDFium with the WASM binary
      const wrapper = await window.initPDFium({ wasmBinary });

      // Debug: log what's available
      console.log("Wrapper type:", typeof wrapper);
      console.log("Wrapper properties:", Object.keys(wrapper).slice(0, 10));

      // Check if there's a nested pdfium property
      if (wrapper.pdfium) {
        console.log("Found nested pdfium instance");
        this.pdfium = wrapper.pdfium;
        console.log("PDFium instance type:", typeof this.pdfium);
        console.log("Has ccall:", typeof this.pdfium.ccall);
        console.log("Has _malloc:", typeof this.pdfium._malloc);
        console.log("PDFium properties sample:", Object.keys(this.pdfium).slice(0, 20));
      } else {
        // The wrapper itself is the PDFium instance
        this.pdfium = wrapper;
        console.log("Using wrapper as PDFium instance");
        console.log("Wrapper functions sample:", Object.keys(wrapper).filter(k => typeof wrapper[k] === 'function').slice(0, 30));
      }

      // Setup API references based on what's available
      this.setupAPIReferences();

      // Try to initialize PDFium extension (may not be needed for this version)
      if (this.api.PDFiumExt_Init) {
        this.api.PDFiumExt_Init();
        console.log("PDFium extension initialized");
      } else {
        console.log("PDFiumExt_Init not found, skipping (may not be required)");
      }

      return true;
    } catch (error) {
      console.error("Failed to initialize PDFium:", error);
      throw error;
    }
  }

  setupAPIReferences() {
    // First, let's see what FPDF functions are available
    const allFunctions = Object.keys(this.pdfium).filter(k => typeof this.pdfium[k] === 'function');
    const fpdfFunctions = allFunctions.filter(k => k.includes('FPDF'));
    console.log("Available FPDF functions:", fpdfFunctions);

    // Check which API style to use (with or without underscores)
    const hasUnderscore = typeof this.pdfium._FPDF_LoadMemDocument === 'function';

    console.log("PDFium API style:", hasUnderscore ? "with underscores" : "without underscores");

    // Setup all API function references
    const functions = [
      'FPDF_LoadMemDocument',
      'FPDF_GetPageCount',
      'FPDF_GetLastError',
      'FPDF_LoadPage',
      'FPDF_GetPageWidthF',
      'FPDF_GetPageHeightF',
      'FPDF_ClosePage',
      'FPDFBitmap_Create',
      'FPDFBitmap_FillRect',
      'FPDF_RenderPageBitmap',
      'FPDFBitmap_GetStride',
      'FPDFBitmap_GetBuffer',
      'FPDFBitmap_Destroy',
      'FPDF_CloseDocument',
      'FPDF_DestroyLibrary',
      'PDFiumExt_Init'
    ];

    for (const func of functions) {
      const withUnderscore = `_${func}`;
      if (hasUnderscore && this.pdfium[withUnderscore]) {
        this.api[func] = this.pdfium[withUnderscore].bind(this.pdfium);
      } else if (this.pdfium[func]) {
        this.api[func] = this.pdfium[func].bind(this.pdfium);
      } else {
        console.warn(`Function ${func} not found in PDFium instance`);
      }
    }

    // Emscripten memory functions (always with underscore)
    this.api.malloc = this.pdfium._malloc ? this.pdfium._malloc.bind(this.pdfium) : null;
    this.api.free = this.pdfium._free ? this.pdfium._free.bind(this.pdfium) : null;

    // Log what we found
    if (!this.api.malloc) {
      console.log("Warning: _malloc not found, will use alternative loading approach");
    }
    if (!this.pdfium.HEAPU8) {
      console.log("Warning: HEAPU8 not found, direct memory access not available");
    }
  }

  async loadPDF(path) {
    try {
      // Fetch the PDF file
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      console.log("PDF fetched, size:", arrayBuffer.byteLength, "bytes");

      const pdfData = new Uint8Array(arrayBuffer);

      // Load the PDF document with PDFium
      let pdfDocument = null;
      let pdfBuffer = null;

      // Try different approaches to load the document
      if (this.pdfium.ccall) {
        // Approach 1: Using ccall (most reliable)
        console.log("Using ccall approach for PDF loading");
        pdfBuffer = this.pdfium.ccall("malloc", "number", ["number"], [pdfData.length]);
        this.pdfium.HEAPU8.set(pdfData, pdfBuffer);

        pdfDocument = this.pdfium.ccall(
          "FPDF_LoadMemDocument",
          "number",
          ["number", "number", "number"],
          [pdfBuffer, pdfData.length, 0]
        );

        // Keep the buffer reference - PDFium needs it
        this.pdfBuffer = pdfBuffer;
      } else if (this.pdfium._malloc && this.pdfium.HEAPU8) {
        // Approach 2: Using _malloc directly (without going through api wrapper)
        console.log("Using direct _malloc approach for PDF loading");
        const pdfDataPtr = this.pdfium._malloc(pdfData.length);
        this.pdfium.HEAPU8.set(pdfData, pdfDataPtr);

        // Call FPDF_LoadMemDocument with the pointer
        pdfDocument = this.api.FPDF_LoadMemDocument(pdfDataPtr, pdfData.length, 0);

        // Keep the buffer reference - PDFium needs it
        this.pdfBuffer = pdfDataPtr;
      } else {
        // Approach 3: Try the wrapper's built-in data handling
        console.log("Trying embedpdf wrapper approach for PDF loading");

        // The embedpdf library might handle the data internally
        // Try passing the data in different formats
        const attempts = [
          () => this.api.FPDF_LoadMemDocument(pdfData, pdfData.byteLength, null),
          () => this.api.FPDF_LoadMemDocument(pdfData, pdfData.byteLength, 0),
          () => this.api.FPDF_LoadMemDocument(pdfData.buffer, pdfData.byteLength, null),
          () => this.api.FPDF_LoadMemDocument(pdfData.buffer, pdfData.byteLength, 0),
          // Try with a password parameter as an empty string
          () => this.api.FPDF_LoadMemDocument(pdfData, pdfData.byteLength, ""),
        ];

        for (const attempt of attempts) {
          try {
            pdfDocument = attempt();
            if (pdfDocument && pdfDocument !== 0) {
              console.log("Successfully loaded PDF with embedpdf wrapper approach");
              break;
            }
          } catch (e) {
            console.log("Attempt failed:", e.message);
          }
        }
      }

      this.pdfDocument = pdfDocument;

      if (!this.pdfDocument || this.pdfDocument === 0) {
        const error = this.api.FPDF_GetLastError ? this.api.FPDF_GetLastError() : "Unknown";
        const errorMessages = {
          0: "Success",
          1: "Unknown error",
          2: "File not found or could not be opened",
          3: "File not in PDF format or corrupted",
          4: "Password required or incorrect password",
          5: "Unsupported security scheme",
          6: "Page not found or content error"
        };

        // Additional debugging
        console.error("PDF loading failed with error:", error);
        console.error("pdfDocument value:", this.pdfDocument);
        console.error("PDF data first bytes:", Array.from(pdfData.slice(0, 10)));
        console.error("Expected PDF header: %PDF-");

        throw new Error(`Failed to load PDF document. Error code: ${error} (${errorMessages[error] || 'Unknown error'})`);
      }

      this.totalPages = this.api.FPDF_GetPageCount(this.pdfDocument);
      console.log("PDF loaded successfully, pages:", this.totalPages);
      return true;
    } catch (error) {
      console.error("Failed to load PDF:", error);
      throw error;
    }
  }

  async init() {
    try {
      // Initialize PDFium
      await this.initializePDFium();

      // Load the PDF
      await this.loadPDF("/sample.pdf");

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
      const page = this.api.FPDF_LoadPage(this.pdfDocument, pageNum - 1); // PDFium uses 0-based indexing
      const width = this.api.FPDF_GetPageWidthF(page);
      const height = this.api.FPDF_GetPageHeightF(page);
      const scaledWidth = Math.floor(width * this.scale);
      const scaledHeight = Math.floor(height * this.scale);

      pageContainer.style.height = `${scaledHeight}px`;
      pageContainer.style.width = `${scaledWidth}px`;

      // Cache the page for later use
      this.pageCache.set(pageNum, { width, height });
      this.api.FPDF_ClosePage(page);

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

    // Get the page (0-based index for PDFium)
    const page = this.api.FPDF_LoadPage(this.pdfDocument, pageNum - 1);

    // Get page dimensions
    const width = this.api.FPDF_GetPageWidthF(page);
    const height = this.api.FPDF_GetPageHeightF(page);
    const scaledWidth = Math.floor(width * this.scale);
    const scaledHeight = Math.floor(height * this.scale);

    // Get or create canvas
    const canvas = pageContainer.querySelector(".pdf-page-canvas");
    const context = canvas.getContext("2d");

    // Set canvas dimensions
    canvas.height = scaledHeight;
    canvas.width = scaledWidth;

    // Hide placeholder, show canvas
    const placeholder = pageContainer.querySelector(".page-placeholder");
    if (placeholder) {
      placeholder.style.display = "none";
    }
    canvas.style.display = "block";

    // Create a bitmap and render the page to it
    const bitmap = this.api.FPDFBitmap_Create(scaledWidth, scaledHeight, 0);

    // Fill with white background
    this.api.FPDFBitmap_FillRect(
      bitmap,
      0,
      0,
      scaledWidth,
      scaledHeight,
      0xffffffff
    );

    // Render the page to the bitmap
    this.api.FPDF_RenderPageBitmap(
      bitmap,
      page,
      0,
      0,
      scaledWidth,
      scaledHeight,
      0,
      0
    );

    // Get the bitmap buffer and convert to ImageData
    const imageData = context.createImageData(scaledWidth, scaledHeight);

    // Get the buffer data
    const stride = this.api.FPDFBitmap_GetStride(bitmap);
    const bufferPtr = this.api.FPDFBitmap_GetBuffer(bitmap);
    const bufferSize = scaledHeight * stride;

    // Access the buffer from WASM memory
    const buffer = new Uint8Array(
      this.pdfium.HEAPU8.buffer,
      bufferPtr,
      bufferSize
    );

    // Convert BGRA to RGBA (PDFium uses BGRA format)
    let srcIndex = 0;
    let dstIndex = 0;
    for (let y = 0; y < scaledHeight; y++) {
      for (let x = 0; x < scaledWidth; x++) {
        imageData.data[dstIndex] = buffer[srcIndex + 2];     // R
        imageData.data[dstIndex + 1] = buffer[srcIndex + 1]; // G
        imageData.data[dstIndex + 2] = buffer[srcIndex];     // B
        imageData.data[dstIndex + 3] = buffer[srcIndex + 3]; // A
        srcIndex += 4;
        dstIndex += 4;
      }
      // Skip padding bytes at the end of each row if stride > width * 4
      srcIndex += stride - scaledWidth * 4;
    }

    context.putImageData(imageData, 0, 0);

    // Clean up bitmap
    this.api.FPDFBitmap_Destroy(bitmap);

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

    const pageContainer = document.querySelector(
      `[data-page-num="${pageNum}"]`,
    );
    if (pageContainer) {
      const canvas = pageContainer.querySelector(".pdf-page-canvas");
      const placeholder = pageContainer.querySelector(".page-placeholder");

      // Clear canvas
      if (pageInfo.context) {
        pageInfo.context.clearRect(0, 0, canvas.width, canvas.height);
      }

      // Hide canvas, show placeholder
      canvas.style.display = "none";
      if (placeholder) {
        placeholder.style.display = "block";
      }
    }

    // Close the page if it's still open
    if (pageInfo.page) {
      this.api.FPDF_ClosePage(pageInfo.page);
    }

    // Remove from rendered pages
    this.renderedPages.delete(pageNum);
    this.updateMemoryInfo();
  }

  enforceMemoryLimit() {
    if (this.renderedPages.size <= this.maxPagesInMemory) {
      return;
    }

    // Sort pages by timestamp (oldest first)
    const sortedPages = Array.from(this.renderedPages.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp,
    );

    // Get currently visible pages
    const visiblePages = new Set(this.getVisiblePageNumbers());

    // Unload oldest non-visible pages
    for (const [pageNum] of sortedPages) {
      if (this.renderedPages.size <= this.maxPagesInMemory) {
        break;
      }

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

      if (
        rect.bottom > containerRect.top &&
        rect.top < containerRect.bottom
      ) {
        visiblePages.push(Number.parseInt(container.dataset.pageNum));
      }
    });

    return visiblePages;
  }

  updateVisiblePages() {
    const visiblePages = this.getVisiblePageNumbers();
    if (visiblePages.length > 0) {
      this.currentPageSpan.textContent = `${visiblePages[0]}`;
    }
  }

  updateMemoryInfo() {
    const renderedCount = this.renderedPages.size;
    this.loadedPagesSpan.textContent = `Pages in memory: ${renderedCount}`;
  }

  setupEventListeners() {
    // Scroll event for current page detection
    this.container.addEventListener("scroll", () => {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        this.updateVisiblePages();
      }, 100);
    });

    // Zoom controls
    document.getElementById("zoom-in").addEventListener("click", () => {
      this.changeZoom(0.1);
    });

    document.getElementById("zoom-out").addEventListener("click", () => {
      this.changeZoom(-0.1);
    });

    document.getElementById("zoom-fit").addEventListener("click", () => {
      this.fitToWidth();
    });
  }

  async changeZoom(delta) {
    const newScale = Math.max(0.5, Math.min(3.0, this.scale + delta));
    if (newScale === this.scale) return;

    this.scale = newScale;
    this.zoomLevelSpan.textContent = `${Math.round(this.scale * 100)}%`;

    // Clear all rendered pages
    for (const pageNum of this.renderedPages.keys()) {
      this.unloadPage(pageNum);
    }

    // Update all page container sizes
    const containers = document.querySelectorAll(".pdf-page-container");
    containers.forEach((container) => {
      const pageNum = Number.parseInt(container.dataset.pageNum);
      const pageInfo = this.pageCache.get(pageNum);
      if (pageInfo) {
        const scaledWidth = Math.floor(pageInfo.width * this.scale);
        const scaledHeight = Math.floor(pageInfo.height * this.scale);
        container.style.width = `${scaledWidth}px`;
        container.style.height = `${scaledHeight}px`;
      }
    });

    // Re-render visible pages
    this.updateVisiblePages();
    const visiblePages = this.getVisiblePageNumbers();
    visiblePages.forEach((pageNum) => {
      this.queuePageRender(pageNum);
    });
  }

  async fitToWidth() {
    const containerWidth = this.container.clientWidth - 40; // Account for padding
    const pageInfo = this.pageCache.get(1); // Use first page as reference

    if (pageInfo) {
      const newScale = containerWidth / pageInfo.width;
      const scaleDelta = newScale - this.scale;
      await this.changeZoom(scaleDelta);
    }
  }

  showError(error) {
    this.errorDiv.textContent = `Error: ${error.message}`;
    this.errorDiv.style.display = "block";
    this.loadingDiv.style.display = "none";
    console.error("PDF Viewer Error:", error);
  }

  // Clean up resources when viewer is destroyed
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }

    // Close all open pages
    for (const pageInfo of this.renderedPages.values()) {
      if (pageInfo.page) {
        this.api.FPDF_ClosePage(pageInfo.page);
      }
    }

    // Close the document
    if (this.pdfDocument && this.pdfium) {
      this.api.FPDF_CloseDocument(this.pdfDocument);
      this.pdfDocument = null;
    }

    // Free the PDF buffer if allocated
    if (this.pdfBuffer && this.pdfium) {
      if (this.pdfium.ccall) {
        this.pdfium.ccall("free", null, ["number"], [this.pdfBuffer]);
      } else if (this.api.free) {
        this.api.free(this.pdfBuffer);
      }
      this.pdfBuffer = null;
    }

    // Clean up PDFium
    if (this.pdfium) {
      this.api.FPDF_DestroyLibrary();
      this.pdfium = null;
    }
  }
}

// Initialize the viewer when the page loads
document.addEventListener("DOMContentLoaded", () => {
  window.pdfViewer = new PDFiumScrollViewer();
});

// Clean up on page unload
window.addEventListener("beforeunload", () => {
  if (window.pdfViewer) {
    window.pdfViewer.destroy();
  }
});