/**
 * Zoom manager with CSS transform + threshold-based re-rasterization
 * Uses CSS zoom for instant feedback, then re-renders at higher quality
 */

import type { RenderScale } from "./types";

export type ZoomChangeCallback = (scale: RenderScale) => void;

export class ZoomManager {
  private cssZoom = 1.0;
  private baseRasterScale: number;
  private devicePixelRatio: number;
  private zoomDelta: number; // Threshold for re-rasterization
  private rerasterTimer: ReturnType<typeof setTimeout> | null = null;
  private onZoomChange: ZoomChangeCallback;

  constructor(onZoomChange: ZoomChangeCallback, zoomDelta = 0.4) {
    this.devicePixelRatio = Math.max(
      1,
      Math.min(window.devicePixelRatio || 1, 3),
    );
    this.baseRasterScale = this.devicePixelRatio;
    this.zoomDelta = zoomDelta;
    this.onZoomChange = onZoomChange;
  }

  /**
   * Set user zoom level (applies CSS transform immediately)
   */
  setZoom(zoom: number): void {
    this.cssZoom = zoom;
    this.scheduleReraster();
  }

  /**
   * Get current CSS zoom level
   */
  getCSSZoom(): number {
    return this.cssZoom;
  }

  /**
   * Get current render scale
   */
  getScale(): RenderScale {
    return {
      cssZoom: this.cssZoom,
      devicePixelRatio: this.devicePixelRatio,
      baseRasterScale: this.baseRasterScale,
    };
  }

  /**
   * Get effective zoom (CSS * base)
   */
  getEffectiveZoom(): number {
    return this.cssZoom * this.baseRasterScale;
  }

  /**
   * Schedule re-rasterization if zoom delta exceeded
   */
  private scheduleReraster(): void {
    // Clear existing timer
    if (this.rerasterTimer) {
      clearTimeout(this.rerasterTimer);
    }

    // Check if we need to re-rasterize
    const needsReraster = Math.abs(this.cssZoom - 1.0) > this.zoomDelta;

    if (needsReraster) {
      // Debounce: wait for zoom to stabilize
      this.rerasterTimer = setTimeout(() => {
        this.performReraster();
      }, 150);
    }
  }

  /**
   * Perform re-rasterization: fold CSS zoom into base scale
   */
  private performReraster(): void {
    // Fold CSS zoom into base raster scale
    this.baseRasterScale *= this.cssZoom;
    this.cssZoom = 1.0;

    // Notify listeners
    this.onZoomChange(this.getScale());

    this.rerasterTimer = null;
  }

  /**
   * Force immediate re-rasterization
   */
  forceReraster(): void {
    if (this.rerasterTimer) {
      clearTimeout(this.rerasterTimer);
      this.rerasterTimer = null;
    }
    if (this.cssZoom !== 1.0) {
      this.performReraster();
    }
  }

  /**
   * Reset zoom to fit width
   */
  resetToFit(pageWidthPt: number, containerWidth: number): void {
    // Calculate zoom to fit page width to container
    // Account for some padding
    const availableWidth = containerWidth - 32;
    const fitZoom = availableWidth / pageWidthPt;

    // Reset base scale and CSS zoom
    this.baseRasterScale = this.devicePixelRatio;
    this.cssZoom = fitZoom;

    this.scheduleReraster();
  }

  /**
   * Zoom in by factor
   */
  zoomIn(factor = 1.2): void {
    this.setZoom(this.cssZoom * factor);
  }

  /**
   * Zoom out by factor
   */
  zoomOut(factor = 1.2): void {
    this.setZoom(this.cssZoom / factor);
  }

  /**
   * Dispose
   */
  dispose(): void {
    if (this.rerasterTimer) {
      clearTimeout(this.rerasterTimer);
      this.rerasterTimer = null;
    }
  }
}
