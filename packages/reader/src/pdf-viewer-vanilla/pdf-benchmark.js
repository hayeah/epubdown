// Manual Performance Measurement Utilities
class BenchmarkRunner {
  constructor() {
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

  async loadPDF(path) {
    updateStatus(`Loading PDF from ${path}...`);
    try {
      const loadingTask = pdfjsLib.getDocument(path);
      this.pdfDocument = await loadingTask.promise;
      updateStatus(
        `PDF loaded successfully: ${this.pdfDocument.numPages} pages`,
        "success",
      );
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
    const pageNumber = 1;
    let previewShown = false;

    const fn = async () => {
      const page = await this.pdfDocument.getPage(pageNumber);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      // Show preview only once
      if (!previewShown) {
        this.showCanvasPreview(canvas, "Single Page Rendering (Page 1)");
        previewShown = true;
      }

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
    const numPages = Math.min(3, this.pdfDocument.numPages);
    let previewCanvases = [];
    let previewShown = false;

    const fn = async () => {
      const tempCanvases = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await this.pdfDocument.getPage(pageNum);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        // Store for preview
        if (!previewShown) {
          const previewCanvas = document.createElement("canvas");
          previewCanvas.width = canvas.width;
          previewCanvas.height = canvas.height;
          const ctx = previewCanvas.getContext("2d");
          ctx.drawImage(canvas, 0, 0);
          tempCanvases.push(previewCanvas);
        }

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
    const numPages = Math.min(3, this.pdfDocument.numPages);
    let previewShown = false;

    const fn = async () => {
      const renderPromises = [];
      const previewCanvases = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const renderPage = async (pageIndex) => {
          const page = await this.pdfDocument.getPage(pageIndex);
          const scale = 1.5;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          // Store for preview
          if (!previewShown) {
            const previewCanvas = document.createElement("canvas");
            previewCanvas.width = canvas.width;
            previewCanvas.height = canvas.height;
            const ctx = previewCanvas.getContext("2d");
            ctx.drawImage(canvas, 0, 0);
            previewCanvases[pageIndex - 1] = previewCanvas;
          }

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
    const pageNumber = 1;
    const scales = [0.5, 1.0, 1.5, 2.0];
    let previewShown = false;

    const fn = async () => {
      const page = await this.pdfDocument.getPage(pageNumber);
      const canvases = [];

      for (const scale of scales) {
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        // Keep canvas for preview
        if (!previewShown) {
          const previewCanvas = document.createElement("canvas");
          previewCanvas.width = canvas.width;
          previewCanvas.height = canvas.height;
          const ctx = previewCanvas.getContext("2d");
          ctx.drawImage(canvas, 0, 0);
          canvases.push({ canvas: previewCanvas, scale });
        }

        canvas.remove();
      }

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

  // Benchmark: Get page and viewport only
  async benchmarkViewportOnly() {
    const pageNumber = 1;

    const fn = async () => {
      const page = await this.pdfDocument.getPage(pageNumber);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      // Access properties to ensure they're computed
      void viewport.width;
      void viewport.height;
    };

    return await this.measure(
      "Get Page and Viewport Only",
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
    const pageNumber = 1;

    const fn = async () => {
      const page = await this.pdfDocument.getPage(pageNumber);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const [renderResult, textContent] = await Promise.all([
        page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise,
        page.getTextContent(),
      ]);

      void textContent.items.length;
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

    const pageNumber = 1;

    const fn = async () => {
      const page = await this.pdfDocument.getPage(pageNumber);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
    };

    return await this.measure(
      "Offscreen Canvas Rendering",
      fn,
      getIterations(),
      getWarmup(),
    );
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
}
