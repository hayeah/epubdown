/**
 * Virtualization manager for keeping only visible pages rendered
 * Uses Intersection Observer API for efficient viewport detection
 */

import type { PageRenderInfo } from "./types";

export type PageVisibilityCallback = (
  pageIndex: number,
  visible: boolean,
) => void;

export class VirtualizationManager {
  private observer: IntersectionObserver | null = null;
  private visiblePages = new Set<number>();
  private renderedPages = new Map<number, PageRenderInfo>();
  private maxPagesAlive: number;
  private onVisibilityChange: PageVisibilityCallback;

  constructor(
    maxPagesAlive: number,
    onVisibilityChange: PageVisibilityCallback,
  ) {
    this.maxPagesAlive = maxPagesAlive;
    this.onVisibilityChange = onVisibilityChange;
  }

  /**
   * Initialize intersection observer with a container element
   */
  init(container: HTMLElement, rootMargin = "200px"): void {
    const options: IntersectionObserverInit = {
      root: container,
      rootMargin,
      threshold: 0.01,
    };

    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        const pageIndex = Number.parseInt(target.dataset.pageIndex || "-1", 10);

        if (pageIndex === -1) continue;

        if (entry.isIntersecting) {
          this.visiblePages.add(pageIndex);
          this.onVisibilityChange(pageIndex, true);
        } else {
          this.visiblePages.delete(pageIndex);
          this.onVisibilityChange(pageIndex, false);
        }
      }
    }, options);
  }

  /**
   * Observe a page element
   */
  observe(element: HTMLElement): void {
    this.observer?.observe(element);
  }

  /**
   * Unobserve a page element
   */
  unobserve(element: HTMLElement): void {
    this.observer?.unobserve(element);
  }

  /**
   * Get currently visible page indices
   */
  getVisiblePages(): number[] {
    return Array.from(this.visiblePages).sort((a, b) => a - b);
  }

  /**
   * Get prefetch pages (visible + buffer)
   */
  getPrefetchPages(buffer = 2): number[] {
    const visible = this.getVisiblePages();
    const prefetch = new Set(visible);

    if (visible.length > 0) {
      const min = Math.min(...visible);
      const max = Math.max(...visible);

      // Add pages before and after
      for (let i = 1; i <= buffer; i++) {
        prefetch.add(min - i);
        prefetch.add(max + i);
      }
    }

    return Array.from(prefetch)
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
  }

  /**
   * Track a rendered page
   */
  trackRendered(info: PageRenderInfo): void {
    this.renderedPages.set(info.pageIndex, info);
    this.enforceMemoryLimit();
  }

  /**
   * Untrack a rendered page
   */
  untrackRendered(pageIndex: number): void {
    this.renderedPages.delete(pageIndex);
  }

  /**
   * Get pages that should be evicted (LRU, not visible)
   */
  getEvictionCandidates(): number[] {
    if (this.renderedPages.size <= this.maxPagesAlive) {
      return [];
    }

    // Sort by timestamp (oldest first)
    const sorted = Array.from(this.renderedPages.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp,
    );

    const candidates: number[] = [];
    const excess = this.renderedPages.size - this.maxPagesAlive;

    for (const [pageIndex] of sorted) {
      if (candidates.length >= excess) break;

      // Don't evict visible pages
      if (!this.visiblePages.has(pageIndex)) {
        candidates.push(pageIndex);
      }
    }

    return candidates;
  }

  /**
   * Enforce memory limit by evicting pages if needed
   */
  private enforceMemoryLimit(): void {
    const candidates = this.getEvictionCandidates();
    for (const pageIndex of candidates) {
      this.onVisibilityChange(pageIndex, false);
      this.renderedPages.delete(pageIndex);
    }
  }

  /**
   * Get number of rendered pages
   */
  getRenderedCount(): number {
    return this.renderedPages.size;
  }

  /**
   * Update max pages alive
   */
  setMaxPagesAlive(max: number): void {
    this.maxPagesAlive = max;
    this.enforceMemoryLimit();
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.visiblePages.clear();
    this.renderedPages.clear();
  }
}
