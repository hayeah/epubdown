/**
 * Render queue with priority scheduling and abort support
 * Manages concurrent render tasks with configurable concurrency
 */

import type { PdfEngine, RenderPageOptions, RenderTask } from "./types";
import { RenderPriority } from "./types";

export class RenderQueue {
  private queue: RenderTask[] = [];
  private running = 0;
  private maxConcurrency: number;
  private engine: PdfEngine;
  private activeTasks = new Map<number, AbortController>();

  constructor(engine: PdfEngine, maxConcurrency = 2) {
    this.engine = engine;
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * Enqueue a render task
   */
  enqueue(
    pageIndex: number,
    scale: RenderPageOptions["scale"],
    target: HTMLCanvasElement,
    priority: RenderPriority = RenderPriority.Visible,
    tile?: RenderPageOptions["tile"],
  ): () => void {
    // Cancel existing task for this page if any
    this.cancelTask(pageIndex);

    const abortController = new AbortController();
    const task: RenderTask = {
      priority,
      pageIndex,
      scale,
      target,
      tile,
      abortController,
    };

    this.queue.push(task);
    this.sortQueue();
    this.pump();

    // Return cancellation handle
    return () => this.cancelTask(pageIndex);
  }

  /**
   * Cancel a specific page render task
   */
  cancelTask(pageIndex: number): void {
    // Cancel active task
    const activeController = this.activeTasks.get(pageIndex);
    if (activeController) {
      activeController.abort();
      this.activeTasks.delete(pageIndex);
    }

    // Remove from queue
    this.queue = this.queue.filter((task) => {
      if (task.pageIndex === pageIndex) {
        task.abortController.abort();
        return false;
      }
      return true;
    });
  }

  /**
   * Cancel all low priority tasks (used during scroll jumps)
   */
  cancelLowPriority(threshold: RenderPriority = RenderPriority.Prefetch): void {
    // Only cancel queued tasks, not running ones
    this.queue = this.queue.filter((task) => {
      if (task.priority < threshold) {
        task.abortController.abort();
        return false;
      }
      return true;
    });
  }

  /**
   * Sort queue by priority (highest first)
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // Same priority: prefer lower page numbers
      return a.pageIndex - b.pageIndex;
    });
  }

  /**
   * Process queue and start tasks
   */
  private async pump(): Promise<void> {
    while (this.running < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      // Skip if already aborted
      if (task.abortController.signal.aborted) continue;

      this.running++;
      this.activeTasks.set(task.pageIndex, task.abortController);

      // Execute render task
      this.executeTask(task)
        .catch((error) => {
          // Ignore abort errors
          if (error.name !== "AbortError") {
            console.error(`Render error for page ${task.pageIndex}:`, error);
          }
        })
        .finally(() => {
          this.running--;
          this.activeTasks.delete(task.pageIndex);
          // Continue pumping
          this.pump();
        });
    }
  }

  /**
   * Execute a single render task
   */
  private async executeTask(task: RenderTask): Promise<void> {
    const opts: RenderPageOptions = {
      pageIndex: task.pageIndex,
      scale: task.scale,
      target: task.target,
      tile: task.tile,
      signal: task.abortController.signal,
    };

    await this.engine.renderPageToCanvas(opts);
  }

  /**
   * Clear all queued tasks
   */
  clear(): void {
    // Cancel all queued tasks
    for (const task of this.queue) {
      task.abortController.abort();
    }
    this.queue = [];

    // Cancel all active tasks
    for (const controller of this.activeTasks.values()) {
      controller.abort();
    }
    this.activeTasks.clear();
  }

  /**
   * Get queue stats
   */
  getStats(): { queued: number; running: number } {
    return {
      queued: this.queue.length,
      running: this.running,
    };
  }

  /**
   * Check if a page is currently rendering
   */
  isRendering(pageIndex: number): boolean {
    return this.activeTasks.has(pageIndex);
  }

  /**
   * Set max concurrency
   */
  setMaxConcurrency(max: number): void {
    this.maxConcurrency = max;
    this.pump();
  }
}
