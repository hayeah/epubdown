// Manual Performance Measurement Utilities for PDFium
class BenchmarkRunner {
  constructor() {
    this.pdfium = null;
    this.pdfDocument = null;
    this.results = [];
    this.lastCanvas = null;
  }

  // Utility to measure function execution time
  async measure(name, fn, iterations = 10, warmupIterations = 2) {
    const times = [];

    // Warmup runs
    for (let i = 0; i < warmupIterations; i++) {
      await fn();
    }

    // Actual measurement runs
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }

    // Calculate statistics
    const sorted = times.sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const stdDev = Math.sqrt(
      times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) /
        times.length,
    );

    return {
      name,
      iterations,
      warmupIterations,
      times,
      min,
      max,
      median,
      mean,
      stdDev,
      p95: sorted[Math.floor(sorted.length * 0.95)] || max,
      p99: sorted[Math.floor(sorted.length * 0.99)] || max,
    };
  }

  async initializePDFium() {
    if (!this.pdfium) {
      updateStatus("Initializing PDFium...");
      try {
        // Fetch the WebAssembly binary
        const pdfiumWasm =
          "https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@1/dist/pdfium.wasm";
        const response = await fetch(pdfiumWasm);
        const wasmBinary = await response.arrayBuffer();

        // Initialize PDFium with the WASM binary
        this.pdfium = await window.initPDFium({ wasmBinary });

        // Critical: Initialize PDFium extension
        this.pdfium.PDFiumExt_Init();

        updateStatus("PDFium initialized successfully", "success");
        return true;
      } catch (error) {
        updateStatus(`Failed to initialize PDFium: ${error.message}`, "error");
        console.error("PDFium Init Error:", error);
        return false;
      }
    }
    return true;
  }

  async loadPDF(path) {
    updateStatus(`Loading PDF from ${path}...`);
    try {
      // First ensure PDFium is initialized
      if (!(await this.initializePDFium())) {
        return false;
      }

      // Fetch the PDF file
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const pdfData = new Uint8Array(arrayBuffer);

      // Load the PDF document with PDFium
      // We need to allocate memory in the WASM heap for the PDF data
      let pdfBuffer;
      try {
        // Check if the module has malloc/free functions
        if (this.pdfium.ccall) {
          // Use ccall to allocate memory and load document
          pdfBuffer = this.pdfium.ccall(
            "malloc",
            "number",
            ["number"],
            [pdfData.length],
          );
          this.pdfium.HEAPU8.set(pdfData, pdfBuffer);

          const documentPtr = this.pdfium.ccall(
            "FPDF_LoadMemDocument",
            "number",
            ["number", "number", "number"],
            [pdfBuffer, pdfData.length, 0],
          );

          if (!documentPtr || documentPtr === 0) {
            const error = this.pdfium.FPDF_GetLastError
              ? this.pdfium.FPDF_GetLastError()
              : "Unknown";
            throw new Error(
              `Failed to load PDF document. Error code: ${error}`,
            );
          }

          // Don't free the buffer yet - PDFium needs it
          this.pdfBuffer = pdfBuffer;
          this.pdfDocument = documentPtr;
        } else {
          // Try direct call with different parameter combinations
          // Some WASM builds expect the data directly
          const documentPtr =
            this.pdfium.FPDF_LoadMemDocument(
              pdfData,
              pdfData.byteLength,
              null,
            ) ||
            this.pdfium.FPDF_LoadMemDocument(
              pdfData.buffer,
              pdfData.byteLength,
              null,
            ) ||
            this.pdfium.FPDF_LoadMemDocument(pdfData, pdfData.byteLength, 0);

          if (!documentPtr || documentPtr === 0) {
            const error = this.pdfium.FPDF_GetLastError
              ? this.pdfium.FPDF_GetLastError()
              : "Unknown";
            throw new Error(
              `Failed to load PDF document. Error code: ${error}`,
            );
          }

          this.pdfDocument = documentPtr;
        }
      } catch (e) {
        if (pdfBuffer && this.pdfium.ccall) {
          this.pdfium.ccall("free", null, ["number"], [pdfBuffer]);
        }
        throw e;
      }

      const pageCount = this.pdfium.FPDF_GetPageCount(this.pdfDocument);

      updateStatus(`PDF loaded successfully: ${pageCount} pages`, "success");
      return true;
    } catch (error) {
      updateStatus(`Failed to load PDF: ${error.message}`, "error");
      console.error("PDF Load Error:", error);
      return false;
    }
  }

  // Show canvas preview if enabled
  showCanvasPreview(canvas, title, append = false) {
    if (!document.getElementById("showCanvas").checked) return;

    const container = document.getElementById("canvasContainer");
    if (!container) return;

    // Clone the canvas for display
    const displayCanvas = document.createElement("canvas");
    displayCanvas.width = canvas.width;
    displayCanvas.height = canvas.height;
    displayCanvas.className = "canvas-preview";

    const ctx = displayCanvas.getContext("2d");
    ctx.drawImage(canvas, 0, 0);

    // Scale down for display if too large
    const maxWidth = 600;
    if (displayCanvas.width > maxWidth) {
      displayCanvas.style.width = maxWidth + "px";
      displayCanvas.style.height = "auto";
    }

    if (!append) {
      container.innerHTML = `<div class="preview-title">${title}</div>`;
    }

    container.appendChild(displayCanvas);
  }

  // Show multiple canvases in a scrollable container
  showMultipleCanvases(canvases, title) {
    if (!document.getElementById("showCanvas").checked) return;

    const container = document.getElementById("canvasContainer");
    if (!container) return;

    container.innerHTML = `<div class="preview-title">${title}</div>`;

    const scrollContainer = document.createElement("div");
    scrollContainer.style.cssText =
      "max-height: 400px; overflow-y: auto; border: 1px solid #3c3c3c; padding: 10px; border-radius: 5px;";

    canvases.forEach((canvas, index) => {
      const displayCanvas = document.createElement("canvas");
      displayCanvas.width = canvas.width;
      displayCanvas.height = canvas.height;
      displayCanvas.className = "canvas-preview";
      displayCanvas.style.marginBottom = "10px";

      const ctx = displayCanvas.getContext("2d");
      ctx.drawImage(canvas, 0, 0);

      // Scale down for display
      const maxWidth = 500;
      if (displayCanvas.width > maxWidth) {
        displayCanvas.style.width = maxWidth + "px";
        displayCanvas.style.height = "auto";
      }

      const pageLabel = document.createElement("div");
      pageLabel.style.cssText = "color: #4ec9b0; margin-bottom: 5px;";
      pageLabel.textContent = `Page ${index + 1}`;

      scrollContainer.appendChild(pageLabel);
      scrollContainer.appendChild(displayCanvas);
    });

    container.appendChild(scrollContainer);
  }

  // Show canvases side by side for comparison
  showScaleComparison(canvasesWithScales, title) {
    if (!document.getElementById("showCanvas").checked) return;

    const container = document.getElementById("canvasContainer");
    if (!container) return;

    container.innerHTML = `<div class="preview-title">${title}</div>`;

    const flexContainer = document.createElement("div");
    flexContainer.style.cssText =
      "display: flex; gap: 10px; overflow-x: auto; padding: 10px; border: 1px solid #3c3c3c; border-radius: 5px;";

    canvasesWithScales.forEach(({ canvas, scale }) => {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "flex-shrink: 0; text-align: center;";

      const scaleLabel = document.createElement("div");
      scaleLabel.style.cssText = "color: #4ec9b0; margin-bottom: 5px;";
      scaleLabel.textContent = `Scale: ${scale}x`;

      const displayCanvas = document.createElement("canvas");
      displayCanvas.width = canvas.width;
      displayCanvas.height = canvas.height;
      displayCanvas.className = "canvas-preview";

      const ctx = displayCanvas.getContext("2d");
      ctx.drawImage(canvas, 0, 0);

      // Scale down proportionally based on original scale
      const baseWidth = 200;
      displayCanvas.style.width = baseWidth * scale + "px";
      displayCanvas.style.height = "auto";

      wrapper.appendChild(scaleLabel);
      wrapper.appendChild(displayCanvas);
      flexContainer.appendChild(wrapper);
    });

    container.appendChild(flexContainer);
  }

  // Benchmark: Render single page to canvas
  async benchmarkSinglePage() {
    const pageNumber = 0; // PDFium uses 0-based indexing
    let previewShown = false;

    const fn = async () => {
      const page = this.pdfium.FPDF_LoadPage(this.pdfDocument, pageNumber);
      const scale = 1.5;

      // Get page dimensions
      const width = this.pdfium.FPDF_GetPageWidthF(page);
      const height = this.pdfium.FPDF_GetPageHeightF(page);
      const scaledWidth = Math.floor(width * scale);
      const scaledHeight = Math.floor(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      const context = canvas.getContext("2d");

      // Create a bitmap and render the page to it
      const bitmap = this.pdfium.FPDFBitmap_Create(
        scaledWidth,
        scaledHeight,
        0,
      );
      this.pdfium.FPDFBitmap_FillRect(
        bitmap,
        0,
        0,
        scaledWidth,
        scaledHeight,
        0xffffffff,
      );
      this.pdfium.FPDF_RenderPageBitmap(
        bitmap,
        page,
        0,
        0,
        scaledWidth,
        scaledHeight,
        0,
        0,
      );

      // Get the bitmap buffer and convert to ImageData
      const imageData = context.createImageData(scaledWidth, scaledHeight);

      // Get the buffer data - embedpdf returns a Uint8ClampedArray
      const stride = this.pdfium.FPDFBitmap_GetStride(bitmap);
      const bufferPtr = this.pdfium.FPDFBitmap_GetBuffer(bitmap);
      const bufferSize = scaledHeight * stride;

      // Access the buffer from WASM memory
      let buffer;
      if (this.pdfium.HEAPU8) {
        buffer = new Uint8Array(
          this.pdfium.HEAPU8.buffer,
          bufferPtr,
          bufferSize,
        );
      } else {
        // Fallback: try to get buffer directly
        buffer = new Uint8Array(bufferSize);
        for (let i = 0; i < bufferSize; i++) {
          buffer[i] = this.pdfium.getValue
            ? this.pdfium.getValue(bufferPtr + i, "i8")
            : 0;
        }
      }

      // Convert BGRA to RGBA (PDFium uses BGRA format)
      let srcIndex = 0;
      let dstIndex = 0;
      for (let y = 0; y < scaledHeight; y++) {
        for (let x = 0; x < scaledWidth; x++) {
          imageData.data[dstIndex] = buffer[srcIndex + 2]; // R
          imageData.data[dstIndex + 1] = buffer[srcIndex + 1]; // G
          imageData.data[dstIndex + 2] = buffer[srcIndex]; // B
          imageData.data[dstIndex + 3] = buffer[srcIndex + 3]; // A
          srcIndex += 4;
          dstIndex += 4;
        }
        // Skip padding bytes at the end of each row if stride > width * 4
        srcIndex += stride - scaledWidth * 4;
      }

      context.putImageData(imageData, 0, 0);

      // Show preview only once
      if (!previewShown) {
        this.showCanvasPreview(canvas, "Single Page Rendering (Page 1)");
        previewShown = true;
      }

      this.pdfium.FPDFBitmap_Destroy(bitmap);
      this.pdfium.FPDF_ClosePage(page);
      canvas.remove();
    };

    return await this.measure(
      "Render Single Page (Page 1)",
      fn,
      getIterations(),
      getWarmup(),
    );
  }

  // Benchmark: Render multiple pages sequentially
  async benchmarkSequentialPages() {
    const numPages = Math.min(
      3,
      this.pdfium.FPDF_GetPageCount(this.pdfDocument),
    );
    let previewCanvases = [];
    let previewShown = false;

    const fn = async () => {
      const tempCanvases = [];

      for (let pageNum = 0; pageNum < numPages; pageNum++) {
        const page = this.pdfium.FPDF_LoadPage(this.pdfDocument, pageNum);
        const scale = 1.5;

        // Get page dimensions
        const width = this.pdfium.FPDF_GetPageWidthF(page);
        const height = this.pdfium.FPDF_GetPageHeightF(page);
        const scaledWidth = Math.floor(width * scale);
        const scaledHeight = Math.floor(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        const context = canvas.getContext("2d");

        // Create a bitmap and render the page to it
        const bitmap = this.pdfium.FPDFBitmap_Create(
          scaledWidth,
          scaledHeight,
          0,
        );
        this.pdfium.FPDFBitmap_FillRect(
          bitmap,
          0,
          0,
          scaledWidth,
          scaledHeight,
          0xffffffff,
        );
        this.pdfium.FPDF_RenderPageBitmap(
          bitmap,
          page,
          0,
          0,
          scaledWidth,
          scaledHeight,
          0,
          0,
        );

        // Get the bitmap buffer and convert to ImageData
        const buffer = this.pdfium.FPDFBitmap_GetBuffer(bitmap);
        const imageData = context.createImageData(scaledWidth, scaledHeight);

        // Convert BGRA to RGBA
        for (let i = 0; i < scaledWidth * scaledHeight * 4; i += 4) {
          imageData.data[i] = buffer[i + 2]; // R
          imageData.data[i + 1] = buffer[i + 1]; // G
          imageData.data[i + 2] = buffer[i]; // B
          imageData.data[i + 3] = buffer[i + 3]; // A
        }

        context.putImageData(imageData, 0, 0);

        // Store for preview
        if (!previewShown) {
          const previewCanvas = document.createElement("canvas");
          previewCanvas.width = canvas.width;
          previewCanvas.height = canvas.height;
          const ctx = previewCanvas.getContext("2d");
          ctx.drawImage(canvas, 0, 0);
          tempCanvases.push(previewCanvas);
        }

        this.pdfium.FPDFBitmap_Destroy(bitmap);
        this.pdfium.FPDF_ClosePage(page);
        canvas.remove();
      }

      // Show preview once
      if (!previewShown && tempCanvases.length > 0) {
        previewCanvases = tempCanvases;
        this.showMultipleCanvases(
          previewCanvases,
          `Sequential Pages (${numPages} pages) - Scrollable`,
        );
        previewShown = true;
      }
    };

    return await this.measure(
      `Render ${numPages} Pages Sequentially`,
      fn,
      Math.max(1, Math.floor(getIterations() / 2)),
      getWarmup(),
    );
  }

  // Benchmark: Render multiple pages in parallel
  async benchmarkParallelPages() {
    const numPages = Math.min(
      3,
      this.pdfium.FPDF_GetPageCount(this.pdfDocument),
    );
    let previewShown = false;

    const fn = async () => {
      const renderPromises = [];
      const previewCanvases = [];

      for (let pageNum = 0; pageNum < numPages; pageNum++) {
        const renderPage = async (pageIndex) => {
          const page = this.pdfium.FPDF_LoadPage(this.pdfDocument, pageIndex);
          const scale = 1.5;

          // Get page dimensions
          const width = this.pdfium.FPDF_GetPageWidthF(page);
          const height = this.pdfium.FPDF_GetPageHeightF(page);
          const scaledWidth = Math.floor(width * scale);
          const scaledHeight = Math.floor(height * scale);

          const canvas = document.createElement("canvas");
          canvas.width = scaledWidth;
          canvas.height = scaledHeight;
          const context = canvas.getContext("2d");

          // Create a bitmap and render the page to it
          const bitmap = this.pdfium.FPDFBitmap_Create(
            scaledWidth,
            scaledHeight,
            0,
          );
          this.pdfium.FPDFBitmap_FillRect(
            bitmap,
            0,
            0,
            scaledWidth,
            scaledHeight,
            0xffffffff,
          );
          this.pdfium.FPDF_RenderPageBitmap(
            bitmap,
            page,
            0,
            0,
            scaledWidth,
            scaledHeight,
            0,
            0,
          );

          // Get the bitmap buffer and convert to ImageData
          const buffer = this.pdfium.FPDFBitmap_GetBuffer(bitmap);
          const imageData = context.createImageData(scaledWidth, scaledHeight);

          // Convert BGRA to RGBA
          for (let i = 0; i < scaledWidth * scaledHeight * 4; i += 4) {
            imageData.data[i] = buffer[i + 2]; // R
            imageData.data[i + 1] = buffer[i + 1]; // G
            imageData.data[i + 2] = buffer[i]; // B
            imageData.data[i + 3] = buffer[i + 3]; // A
          }

          context.putImageData(imageData, 0, 0);

          // Store for preview
          if (!previewShown) {
            const previewCanvas = document.createElement("canvas");
            previewCanvas.width = canvas.width;
            previewCanvas.height = canvas.height;
            const ctx = previewCanvas.getContext("2d");
            ctx.drawImage(canvas, 0, 0);
            previewCanvases[pageIndex] = previewCanvas;
          }

          this.pdfium.FPDFBitmap_Destroy(bitmap);
          this.pdfium.FPDF_ClosePage(page);
          canvas.remove();
        };

        renderPromises.push(renderPage(pageNum));
      }

      await Promise.all(renderPromises);

      // Show preview once
      if (!previewShown && previewCanvases.length > 0) {
        this.showMultipleCanvases(
          previewCanvases,
          `Parallel Pages (${numPages} pages rendered simultaneously)`,
        );
        previewShown = true;
      }
    };

    return await this.measure(
      `Render ${numPages} Pages in Parallel`,
      fn,
      Math.max(1, Math.floor(getIterations() / 2)),
      getWarmup(),
    );
  }

  // Benchmark: Render at different scales
  async benchmarkDifferentScales() {
    const pageNumber = 0;
    const scales = [0.5, 1.0, 1.5, 2.0];
    let previewShown = false;

    const fn = async () => {
      const page = this.pdfium.FPDF_LoadPage(this.pdfDocument, pageNumber);
      const canvases = [];

      // Get base page dimensions
      const width = this.pdfium.FPDF_GetPageWidthF(page);
      const height = this.pdfium.FPDF_GetPageHeightF(page);

      for (const scale of scales) {
        const scaledWidth = Math.floor(width * scale);
        const scaledHeight = Math.floor(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        const context = canvas.getContext("2d");

        // Create a bitmap and render the page to it
        const bitmap = this.pdfium.FPDFBitmap_Create(
          scaledWidth,
          scaledHeight,
          0,
        );
        this.pdfium.FPDFBitmap_FillRect(
          bitmap,
          0,
          0,
          scaledWidth,
          scaledHeight,
          0xffffffff,
        );
        this.pdfium.FPDF_RenderPageBitmap(
          bitmap,
          page,
          0,
          0,
          scaledWidth,
          scaledHeight,
          0,
          0,
        );

        // Get the bitmap buffer and convert to ImageData
        const buffer = this.pdfium.FPDFBitmap_GetBuffer(bitmap);
        const imageData = context.createImageData(scaledWidth, scaledHeight);

        // Convert BGRA to RGBA
        for (let i = 0; i < scaledWidth * scaledHeight * 4; i += 4) {
          imageData.data[i] = buffer[i + 2]; // R
          imageData.data[i + 1] = buffer[i + 1]; // G
          imageData.data[i + 2] = buffer[i]; // B
          imageData.data[i + 3] = buffer[i + 3]; // A
        }

        context.putImageData(imageData, 0, 0);

        // Keep canvas for preview
        if (!previewShown) {
          const previewCanvas = document.createElement("canvas");
          previewCanvas.width = canvas.width;
          previewCanvas.height = canvas.height;
          const ctx = previewCanvas.getContext("2d");
          ctx.drawImage(canvas, 0, 0);
          canvases.push({ canvas: previewCanvas, scale });
        }

        this.pdfium.FPDFBitmap_Destroy(bitmap);
        canvas.remove();
      }

      this.pdfium.FPDF_ClosePage(page);

      // Show scale comparison preview
      if (!previewShown && canvases.length > 0) {
        this.showScaleComparison(
          canvases,
          `Different Scales (0.5x, 1.0x, 1.5x, 2.0x) - Side by Side`,
        );
        previewShown = true;
      }
    };

    return await this.measure(
      "Render at 4 Different Scales",
      fn,
      Math.max(1, Math.floor(getIterations() / 2)),
      getWarmup(),
    );
  }

  // Benchmark: Get page and dimensions only
  async benchmarkViewportOnly() {
    const pageNumber = 0;

    const fn = async () => {
      const page = this.pdfium.FPDF_LoadPage(this.pdfDocument, pageNumber);
      const scale = 1.5;

      // Get page dimensions
      const width = this.pdfium.FPDF_GetPageWidthF(page);
      const height = this.pdfium.FPDF_GetPageHeightF(page);
      const scaledWidth = Math.floor(width * scale);
      const scaledHeight = Math.floor(height * scale);

      // Access properties to ensure they're computed
      void scaledWidth;
      void scaledHeight;

      this.pdfium.FPDF_ClosePage(page);
    };

    return await this.measure(
      "Get Page and Dimensions Only",
      fn,
      getIterations() * 10,
      getWarmup() * 2,
    );
  }

  // Benchmark: Canvas creation and destruction
  async benchmarkCanvasOperations() {
    const fn = () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = 1224;
      canvas.height = 1584;

      context.clearRect(0, 0, canvas.width, canvas.height);

      canvas.remove();
    };

    return await this.measure(
      "Canvas Create/Destroy Operations",
      fn,
      getIterations() * 100,
      getWarmup() * 10,
    );
  }

  // Benchmark: Render with text extraction
  async benchmarkWithTextExtraction() {
    const pageNumber = 0;

    const fn = async () => {
      const page = this.pdfium.FPDF_LoadPage(this.pdfDocument, pageNumber);
      const scale = 1.5;

      // Get page dimensions
      const width = this.pdfium.FPDF_GetPageWidthF(page);
      const height = this.pdfium.FPDF_GetPageHeightF(page);
      const scaledWidth = Math.floor(width * scale);
      const scaledHeight = Math.floor(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      const context = canvas.getContext("2d");

      // Create a bitmap and render the page to it
      const bitmap = this.pdfium.FPDFBitmap_Create(
        scaledWidth,
        scaledHeight,
        0,
      );
      this.pdfium.FPDFBitmap_FillRect(
        bitmap,
        0,
        0,
        scaledWidth,
        scaledHeight,
        0xffffffff,
      );
      this.pdfium.FPDF_RenderPageBitmap(
        bitmap,
        page,
        0,
        0,
        scaledWidth,
        scaledHeight,
        0,
        0,
      );

      // Get text page
      const textPage = this.pdfium.FPDFText_LoadPage(page);
      const charCount = this.pdfium.FPDFText_CountChars(textPage);

      // Get the bitmap buffer and convert to ImageData
      const imageData = context.createImageData(scaledWidth, scaledHeight);

      // Get the buffer data - embedpdf returns a Uint8ClampedArray
      const stride = this.pdfium.FPDFBitmap_GetStride(bitmap);
      const bufferPtr = this.pdfium.FPDFBitmap_GetBuffer(bitmap);
      const bufferSize = scaledHeight * stride;

      // Access the buffer from WASM memory
      let buffer;
      if (this.pdfium.HEAPU8) {
        buffer = new Uint8Array(
          this.pdfium.HEAPU8.buffer,
          bufferPtr,
          bufferSize,
        );
      } else {
        // Fallback: try to get buffer directly
        buffer = new Uint8Array(bufferSize);
        for (let i = 0; i < bufferSize; i++) {
          buffer[i] = this.pdfium.getValue
            ? this.pdfium.getValue(bufferPtr + i, "i8")
            : 0;
        }
      }

      // Convert BGRA to RGBA (PDFium uses BGRA format)
      let srcIndex = 0;
      let dstIndex = 0;
      for (let y = 0; y < scaledHeight; y++) {
        for (let x = 0; x < scaledWidth; x++) {
          imageData.data[dstIndex] = buffer[srcIndex + 2]; // R
          imageData.data[dstIndex + 1] = buffer[srcIndex + 1]; // G
          imageData.data[dstIndex + 2] = buffer[srcIndex]; // B
          imageData.data[dstIndex + 3] = buffer[srcIndex + 3]; // A
          srcIndex += 4;
          dstIndex += 4;
        }
        // Skip padding bytes at the end of each row if stride > width * 4
        srcIndex += stride - scaledWidth * 4;
      }

      context.putImageData(imageData, 0, 0);

      // Access char count to ensure it's computed
      void charCount;

      this.pdfium.FPDFText_ClosePage(textPage);
      this.pdfium.FPDFBitmap_Destroy(bitmap);
      this.pdfium.FPDF_ClosePage(page);
      canvas.remove();
    };

    return await this.measure(
      "Render with Text Extraction",
      fn,
      Math.max(1, Math.floor(getIterations() / 2)),
      getWarmup(),
    );
  }

  // Benchmark: Offscreen canvas rendering
  async benchmarkOffscreenCanvas() {
    if (!window.OffscreenCanvas) {
      return {
        name: "Offscreen Canvas Rendering",
        error: "OffscreenCanvas not supported in this browser",
      };
    }

    const pageNumber = 0;

    const fn = async () => {
      const page = this.pdfium.FPDF_LoadPage(this.pdfDocument, pageNumber);
      const scale = 1.5;

      // Get page dimensions
      const width = this.pdfium.FPDF_GetPageWidthF(page);
      const height = this.pdfium.FPDF_GetPageHeightF(page);
      const scaledWidth = Math.floor(width * scale);
      const scaledHeight = Math.floor(height * scale);

      const canvas = new OffscreenCanvas(scaledWidth, scaledHeight);
      const context = canvas.getContext("2d");

      // Create a bitmap and render the page to it
      const bitmap = this.pdfium.FPDFBitmap_Create(
        scaledWidth,
        scaledHeight,
        0,
      );
      this.pdfium.FPDFBitmap_FillRect(
        bitmap,
        0,
        0,
        scaledWidth,
        scaledHeight,
        0xffffffff,
      );
      this.pdfium.FPDF_RenderPageBitmap(
        bitmap,
        page,
        0,
        0,
        scaledWidth,
        scaledHeight,
        0,
        0,
      );

      // Get the bitmap buffer and convert to ImageData
      const imageData = context.createImageData(scaledWidth, scaledHeight);

      // Get the buffer data - embedpdf returns a Uint8ClampedArray
      const stride = this.pdfium.FPDFBitmap_GetStride(bitmap);
      const bufferPtr = this.pdfium.FPDFBitmap_GetBuffer(bitmap);
      const bufferSize = scaledHeight * stride;

      // Access the buffer from WASM memory
      let buffer;
      if (this.pdfium.HEAPU8) {
        buffer = new Uint8Array(
          this.pdfium.HEAPU8.buffer,
          bufferPtr,
          bufferSize,
        );
      } else {
        // Fallback: try to get buffer directly
        buffer = new Uint8Array(bufferSize);
        for (let i = 0; i < bufferSize; i++) {
          buffer[i] = this.pdfium.getValue
            ? this.pdfium.getValue(bufferPtr + i, "i8")
            : 0;
        }
      }

      // Convert BGRA to RGBA (PDFium uses BGRA format)
      let srcIndex = 0;
      let dstIndex = 0;
      for (let y = 0; y < scaledHeight; y++) {
        for (let x = 0; x < scaledWidth; x++) {
          imageData.data[dstIndex] = buffer[srcIndex + 2]; // R
          imageData.data[dstIndex + 1] = buffer[srcIndex + 1]; // G
          imageData.data[dstIndex + 2] = buffer[srcIndex]; // B
          imageData.data[dstIndex + 3] = buffer[srcIndex + 3]; // A
          srcIndex += 4;
          dstIndex += 4;
        }
        // Skip padding bytes at the end of each row if stride > width * 4
        srcIndex += stride - scaledWidth * 4;
      }

      context.putImageData(imageData, 0, 0);

      this.pdfium.FPDFBitmap_Destroy(bitmap);
      this.pdfium.FPDF_ClosePage(page);
    };

    return await this.measure(
      "Offscreen Canvas Rendering",
      fn,
      getIterations(),
      getWarmup(),
    );
  }

  // Clean up resources
  cleanup() {
    if (this.pdfDocument && this.pdfium) {
      this.pdfium.FPDF_CloseDocument(this.pdfDocument);
      this.pdfDocument = null;
    }
    if (this.pdfBuffer && this.pdfium && this.pdfium.ccall) {
      this.pdfium.ccall("free", null, ["number"], [this.pdfBuffer]);
      this.pdfBuffer = null;
    }
    if (this.pdfium) {
      // PDFium cleanup
      this.pdfium.FPDF_DestroyLibrary();
      this.pdfium = null;
    }
  }
}

// UI Helper Functions
function updateStatus(message, type = "info") {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = "status " + type;
}

function getIterations() {
  return parseInt(document.getElementById("iterations").value) || 10;
}

function getWarmup() {
  return parseInt(document.getElementById("warmup").value) || 2;
}

function formatResult(result) {
  if (result.error) {
    return `
            <div class="result-item">
                <div class="result-title">${result.name}</div>
                <div class="error">Error: ${result.error}</div>
            </div>
        `;
  }

  return `
        <div class="result-item">
            <div class="result-title">${result.name}</div>
            <div>Iterations: <span class="metric">${result.iterations}</span> (warmup: ${result.warmupIterations})</div>
            <div>Mean: <span class="metric">${result.mean.toFixed(2)}ms</span></div>
            <div>Median: <span class="metric">${result.median.toFixed(2)}ms</span></div>
            <div>Min: <span class="metric">${result.min.toFixed(2)}ms</span></div>
            <div>Max: <span class="metric">${result.max.toFixed(2)}ms</span></div>
            <div>Std Dev: <span class="metric">${result.stdDev.toFixed(2)}ms</span></div>
            <div>P95: <span class="metric">${result.p95.toFixed(2)}ms</span></div>
            <div>P99: <span class="metric">${result.p99.toFixed(2)}ms</span></div>
            <div>Ops/sec: <span class="metric">${(1000 / result.mean).toFixed(2)}</span></div>
        </div>
    `;
}

function displayResults(results) {
  const resultsDiv = document.getElementById("results");
  const timestamp = new Date().toLocaleTimeString();

  let html = `<div style="color: #569cd6; margin-bottom: 10px;">Results - ${timestamp}</div>`;

  for (const result of results) {
    html += formatResult(result);
  }

  resultsDiv.innerHTML = html + resultsDiv.innerHTML;
}

function clearResults() {
  document.getElementById("results").innerHTML = "";
  document.getElementById("canvasContainer").innerHTML = "";
  updateStatus("Results cleared");
}

// Create a comparison table from results
function createComparisonTable(results) {
  if (!results || results.length === 0) return "";

  let html = `
        <table class="results-table">
            <thead>
                <tr>
                    <th>Benchmark</th>
                    <th>Iterations</th>
                    <th>Mean (ms)</th>
                    <th>Median (ms)</th>
                    <th>Min (ms)</th>
                    <th>Max (ms)</th>
                    <th>Std Dev</th>
                    <th>P95 (ms)</th>
                    <th>Ops/sec</th>
                </tr>
            </thead>
            <tbody>
    `;

  // Find best values for highlighting
  const validResults = results.filter((r) => !r.error);
  const minMean = Math.min(...validResults.map((r) => r.mean || Infinity));
  const maxOps = Math.max(...validResults.map((r) => 1000 / r.mean || 0));

  for (const result of results) {
    if (result.error) {
      html += `
                <tr>
                    <td>${result.name}</td>
                    <td colspan="8" class="error">Error: ${result.error}</td>
                </tr>
            `;
    } else {
      const ops = 1000 / result.mean;
      const isBestMean = result.mean === minMean;
      const isBestOps = ops === maxOps;

      html += `
                <tr>
                    <td>${result.name}</td>
                    <td>${result.iterations}</td>
                    <td class="${isBestMean ? "best-value" : "metric-value"}">${result.mean.toFixed(2)}</td>
                    <td class="metric-value">${result.median.toFixed(2)}</td>
                    <td class="metric-value">${result.min.toFixed(2)}</td>
                    <td class="metric-value">${result.max.toFixed(2)}</td>
                    <td class="metric-value">${result.stdDev.toFixed(2)}</td>
                    <td class="metric-value">${result.p95.toFixed(2)}</td>
                    <td class="${isBestOps ? "best-value" : "metric-value"}">${ops.toFixed(2)}</td>
                </tr>
            `;
    }
  }

  html += `
            </tbody>
        </table>
    `;

  return html;
}

// Global runner instance
const runner = new BenchmarkRunner();

// Benchmark execution functions
async function runSingleBenchmark(type) {
  const pdfPath = document.getElementById("pdfPath").value;

  if (!runner.pdfDocument) {
    const loaded = await runner.loadPDF(pdfPath);
    if (!loaded) return;
  }

  updateStatus(`Running ${type} benchmark...`);

  let result;
  try {
    switch (type) {
      case "singlePage":
        result = await runner.benchmarkSinglePage();
        break;
      case "sequential":
        result = await runner.benchmarkSequentialPages();
        break;
      case "parallel":
        result = await runner.benchmarkParallelPages();
        break;
      case "scales":
        result = await runner.benchmarkDifferentScales();
        break;
      case "viewport":
        result = await runner.benchmarkViewportOnly();
        break;
      case "canvas":
        result = await runner.benchmarkCanvasOperations();
        break;
      case "textExtraction":
        result = await runner.benchmarkWithTextExtraction();
        break;
      case "offscreen":
        result = await runner.benchmarkOffscreenCanvas();
        break;
    }

    if (result) {
      displayResults([result]);
      updateStatus("Benchmark completed", "success");
    }
  } catch (error) {
    updateStatus(`Benchmark failed: ${error.message}`, "error");
    console.error("Benchmark error:", error);
  }
}

async function runAllBenchmarks() {
  const pdfPath = document.getElementById("pdfPath").value;

  const loaded = await runner.loadPDF(pdfPath);
  if (!loaded) return;

  const benchmarks = [
    { name: "Single Page", fn: () => runner.benchmarkSinglePage() },
    { name: "Sequential Pages", fn: () => runner.benchmarkSequentialPages() },
    { name: "Parallel Pages", fn: () => runner.benchmarkParallelPages() },
    { name: "Different Scales", fn: () => runner.benchmarkDifferentScales() },
    { name: "Viewport Only", fn: () => runner.benchmarkViewportOnly() },
    { name: "Canvas Operations", fn: () => runner.benchmarkCanvasOperations() },
    {
      name: "With Text Extraction",
      fn: () => runner.benchmarkWithTextExtraction(),
    },
    { name: "Offscreen Canvas", fn: () => runner.benchmarkOffscreenCanvas() },
  ];

  const results = [];

  for (const bench of benchmarks) {
    updateStatus(
      `Running ${bench.name}... (${results.length + 1}/${benchmarks.length})`,
    );
    try {
      const result = await bench.fn();
      results.push(result);
    } catch (error) {
      results.push({
        name: bench.name,
        error: error.message,
      });
      console.error(`${bench.name} failed:`, error);
    }
  }

  // Display comparison table
  const resultsDiv = document.getElementById("results");
  const timestamp = new Date().toLocaleTimeString();

  resultsDiv.innerHTML =
    `
        <div style="color: #569cd6; margin-bottom: 10px; font-size: 16px;">
            Benchmark Results - ${timestamp}
        </div>
        ${createComparisonTable(results)}
        <div style="margin-top: 20px; padding: 10px; background: #1e1e1e; border-radius: 5px;">
            <div style="color: #4ec9b0; margin-bottom: 5px;">Summary:</div>
            <div>Total benchmarks: ${results.length}</div>
            <div>Successful: ${results.filter((r) => !r.error).length}</div>
            <div>Failed: ${results.filter((r) => r.error).length}</div>
        </div>
    ` + resultsDiv.innerHTML;

  updateStatus("All benchmarks completed", "success");

  // Log detailed results to console
  console.log("Benchmark Results:", results);

  // Log comparison data
  console.table(
    results
      .filter((r) => !r.error)
      .map((r) => ({
        Benchmark: r.name,
        "Mean (ms)": r.mean.toFixed(2),
        "Median (ms)": r.median.toFixed(2),
        "Min (ms)": r.min.toFixed(2),
        "Max (ms)": r.max.toFixed(2),
        "Ops/sec": (1000 / r.mean).toFixed(2),
      })),
  );

  // Clean up resources
  runner.cleanup();
}

// Make functions available globally
window.runAllBenchmarks = runAllBenchmarks;
window.clearResults = clearResults;
