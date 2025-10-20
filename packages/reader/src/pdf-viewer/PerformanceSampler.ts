/**
 * Performance sampler for collecting metrics
 * Tracks TTFP, memory, FPS, long tasks, etc.
 */

import type { PdfEngine, PerfSample } from "./types";

export type PerfSampleCallback = (sample: PerfSample) => void;

export class PerformanceSampler {
  private engine: PdfEngine;
  private route: PerfSample["route"];
  private onSample: PerfSampleCallback;
  private docId?: string;

  // Metrics tracking
  private ttfp: number | null = null;
  private lastRender: number | null = null;
  private frameCount = 0;
  private lastFrameTime = performance.now();
  private longTaskCount = 0;
  private longTaskObserver: PerformanceObserver | null = null;
  private sampleInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    engine: PdfEngine,
    route: PerfSample["route"],
    onSample: PerfSampleCallback,
  ) {
    this.engine = engine;
    this.route = route;
    this.onSample = onSample;
  }

  /**
   * Start sampling
   */
  start(docId?: string): void {
    this.docId = docId;
    this.setupLongTaskObserver();
    this.startFrameCounter();
    this.startSampleInterval();
  }

  /**
   * Mark time to first page
   */
  markTTFP(): void {
    if (this.ttfp === null) {
      this.ttfp = performance.now();
    }
  }

  /**
   * Mark last render time
   */
  markRender(duration: number): void {
    this.lastRender = duration;
  }

  /**
   * Setup long task observer
   */
  private setupLongTaskObserver(): void {
    try {
      if ("PerformanceObserver" in window) {
        this.longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              this.longTaskCount++;
            }
          }
        });
        this.longTaskObserver.observe({ entryTypes: ["longtask"] });
      }
    } catch (error) {
      // Long task API not supported
      console.warn("Long task observer not supported:", error);
    }
  }

  /**
   * Start frame counter
   */
  private startFrameCounter(): void {
    const countFrame = () => {
      this.frameCount++;
      requestAnimationFrame(countFrame);
    };
    requestAnimationFrame(countFrame);
  }

  /**
   * Start periodic sampling
   */
  private startSampleInterval(): void {
    this.sampleInterval = setInterval(() => {
      this.emitSample();
    }, 2000); // Every 2 seconds
  }

  /**
   * Emit a performance sample
   */
  emitSample(pageIndex?: number): void {
    const now = performance.now();
    const elapsed = now - this.lastFrameTime;
    const fps = Math.round((this.frameCount / elapsed) * 1000);

    const sample: PerfSample = {
      ts: Date.now(),
      route: this.route,
      docId: this.docId,
      pageIndex,
      ttfp_ms: this.ttfp || undefined,
      lastRender_ms: this.lastRender || undefined,
      jsHeap_bytes: this.getJSHeapSize(),
      uaMemory: this.getUAMemory(),
      wasm_bytes: this.engine.getWasmBytes?.(),
      gpuEst_bytes: undefined, // Set externally
      framesLast2s: fps,
      longTasksLast2s: this.longTaskCount,
      pagesAlive: 0, // Set externally
    };

    // Reset counters
    this.frameCount = 0;
    this.lastFrameTime = now;
    this.longTaskCount = 0;

    this.onSample(sample);
  }

  /**
   * Get JS heap size (Chromium only)
   */
  private getJSHeapSize(): number | undefined {
    const memory = (performance as any).memory;
    return memory?.usedJSHeapSize;
  }

  /**
   * Get UA-specific memory breakdown (Chromium only)
   */
  private getUAMemory(): unknown {
    // This is async in real browsers, but we can't await here
    // Return undefined for now, or implement async sampling
    return undefined;
  }

  /**
   * Get UA memory asynchronously
   */
  async getUAMemoryAsync(): Promise<unknown> {
    try {
      // @ts-ignore - Chromium-specific API
      if (performance.measureUserAgentSpecificMemory) {
        // @ts-ignore
        return await performance.measureUserAgentSpecificMemory();
      }
    } catch (error) {
      // Not supported
    }
    return undefined;
  }

  /**
   * Stop sampling
   */
  stop(): void {
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
    }
    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
      this.longTaskObserver = null;
    }
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.stop();
  }
}
