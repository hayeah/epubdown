/**
 * Canvas pool for reusing canvas elements
 * Reduces memory allocations and GPU texture creation overhead
 */

export class CanvasPool {
  private pool: HTMLCanvasElement[] = [];
  private inUse = new Set<HTMLCanvasElement>();

  /**
   * Acquire a canvas from the pool
   */
  acquire(): HTMLCanvasElement {
    let canvas: HTMLCanvasElement;

    if (this.pool.length > 0) {
      canvas = this.pool.pop()!;
    } else {
      canvas = document.createElement("canvas");
      canvas.className = "pdf-page-canvas";
    }

    this.inUse.add(canvas);
    return canvas;
  }

  /**
   * Release a canvas back to the pool
   */
  release(canvas: HTMLCanvasElement): void {
    if (!this.inUse.has(canvas)) {
      return;
    }

    // Clear the canvas to free GPU texture memory
    this.clearCanvas(canvas);

    this.inUse.delete(canvas);
    this.pool.push(canvas);
  }

  /**
   * Clear canvas and reset dimensions to free GPU memory
   */
  private clearCanvas(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    // Reset dimensions to drop GPU texture
    canvas.width = 0;
    canvas.height = 0;
    canvas.style.width = "";
    canvas.style.height = "";
  }

  /**
   * Get number of canvases in use
   */
  getInUseCount(): number {
    return this.inUse.size;
  }

  /**
   * Get number of canvases available in pool
   */
  getAvailableCount(): number {
    return this.pool.length;
  }

  /**
   * Estimate GPU memory usage in bytes
   */
  estimateGPUMemory(): number {
    let totalBytes = 0;
    for (const canvas of this.inUse) {
      // RGBA = 4 bytes per pixel
      totalBytes += canvas.width * canvas.height * 4;
    }
    return totalBytes;
  }

  /**
   * Dispose all canvases
   */
  dispose(): void {
    // Clear all canvases
    for (const canvas of this.pool) {
      this.clearCanvas(canvas);
    }
    for (const canvas of this.inUse) {
      this.clearCanvas(canvas);
    }

    this.pool = [];
    this.inUse.clear();
  }
}
