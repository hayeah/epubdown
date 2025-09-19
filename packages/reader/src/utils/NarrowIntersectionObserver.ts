/**
 * NarrowIntersectionObserver provides a precise intersection detection pattern
 * using a narrow window (1% of viewport height) positioned at a specific point
 * from the top of the viewport.
 *
 * This approach mimics where the reader's eyes typically fall when reading,
 * providing more stable and accurate progress tracking compared to broad
 * intersection windows.
 */

export interface NarrowIntersectionOptions {
  /**
   * Position of the narrow intersection window from the top of viewport (0-1)
   * Examples:
   * - 0.1 = 10% from top (typical reading position for PDFs)
   * - 0.2 = 20% from top (comfortable reading position for text)
   */
  topPosition?: number;

  /**
   * Height of the intersection window as percentage of viewport (0-1)
   * Default is 0.01 (1% of viewport height)
   */
  windowHeight?: number;

  /**
   * Callback when elements intersect with the narrow window
   */
  onIntersect?: (entry: IntersectionObserverEntry) => void;

  /**
   * Enable debug visualization of the intersection window
   */
  debug?: boolean;
}

export class NarrowIntersectionObserver {
  private observer: IntersectionObserver | null = null;
  private debugBox: HTMLDivElement | null = null;
  private options: Required<NarrowIntersectionOptions>;
  private trackedElements = new Set<Element>();

  constructor(options: NarrowIntersectionOptions = {}) {
    this.options = {
      topPosition: options.topPosition ?? 0.1, // 10% from top by default
      windowHeight: options.windowHeight ?? 0.01, // 1% window height
      onIntersect: options.onIntersect ?? (() => {}),
      debug: options.debug ?? false,
    };

    if (this.options.debug) {
      this.showDebugBox();
    }
  }

  /**
   * Get the rootMargin string for IntersectionObserver.
   * Creates a narrow window at the specified position.
   */
  private get rootMargin(): string {
    const topMargin = -(this.options.topPosition * 100); // negative percentage from top
    const bottomMargin = -(
      (1 - this.options.topPosition - this.options.windowHeight) *
      100
    );
    return `${topMargin}% 0px ${bottomMargin}% 0px`;
  }

  /**
   * Get the scroll offset for restoring positions.
   * Elements should be scrolled to this offset to align with the intersection window.
   */
  get scrollOffset(): number {
    return window.innerHeight * this.options.topPosition;
  }

  /**
   * Create and start the intersection observer
   */
  start(): void {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.options.onIntersect(entry);

            if (this.options.debug) {
              this.highlightElement(entry.target);
            }
          } else if (this.options.debug) {
            this.unhighlightElement(entry.target);
          }
        }
      },
      {
        rootMargin: this.rootMargin,
        threshold: 0,
      },
    );
  }

  /**
   * Observe an element
   */
  observe(element: Element): void {
    if (!this.observer) {
      this.start();
    }
    this.observer?.observe(element);
    this.trackedElements.add(element);
  }

  /**
   * Unobserve an element
   */
  unobserve(element: Element): void {
    this.observer?.unobserve(element);
    this.trackedElements.delete(element);
    if (this.options.debug) {
      this.unhighlightElement(element);
    }
  }

  /**
   * Stop observing all elements and clean up
   */
  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.options.debug) {
      for (const element of this.trackedElements) {
        this.unhighlightElement(element);
      }
    }

    this.trackedElements.clear();
    this.hideDebugBox();
  }

  /**
   * Scroll an element to align with the intersection window
   */
  scrollToElement(element: Element): void {
    if (element && "scrollIntoView" in element) {
      (element as HTMLElement).scrollIntoView({
        block: "start",
        behavior: "instant",
      });
      window.scrollBy(0, -this.scrollOffset);
    }
  }

  /**
   * Enable or disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.options.debug = enabled;

    if (enabled) {
      this.showDebugBox();
    } else {
      this.hideDebugBox();
      for (const element of this.trackedElements) {
        this.unhighlightElement(element);
      }
    }
  }

  /**
   * Show debug visualization of the intersection window
   */
  private showDebugBox(): void {
    if (this.debugBox) return;

    this.debugBox = document.createElement("div");
    Object.assign(this.debugBox.style, {
      position: "fixed",
      top: `${this.options.topPosition * 100}%`,
      left: "0",
      right: "0",
      height: `${this.options.windowHeight * 100}%`,
      border: "2px dashed red",
      background: "rgba(255, 0, 0, 0.05)",
      pointerEvents: "none",
      zIndex: "999999",
    });

    // Add a label
    const label = document.createElement("div");
    Object.assign(label.style, {
      position: "absolute",
      right: "10px",
      top: "50%",
      transform: "translateY(-50%)",
      background: "rgba(255, 255, 255, 0.9)",
      padding: "2px 6px",
      fontSize: "12px",
      color: "red",
      borderRadius: "3px",
    });
    label.textContent = `Intersection: ${this.options.topPosition * 100}%`;
    this.debugBox.appendChild(label);

    document.body.appendChild(this.debugBox);
  }

  /**
   * Hide debug visualization
   */
  private hideDebugBox(): void {
    if (this.debugBox) {
      document.body.removeChild(this.debugBox);
      this.debugBox = null;
    }
  }

  /**
   * Highlight an element in debug mode
   */
  private highlightElement(element: Element): void {
    const el = element as HTMLElement;
    el.style.outline = "2px solid rgba(0, 0, 255, 0.5)";
    el.style.background = "rgba(0, 0, 255, 0.05)";
  }

  /**
   * Remove highlight from an element
   */
  private unhighlightElement(element: Element): void {
    const el = element as HTMLElement;
    el.style.outline = "";
    el.style.background = "";
  }
}

// Global debug toggle for development
if (typeof window !== "undefined") {
  (window as any).toggleNarrowIntersectionDebug = (topPosition?: number) => {
    console.log(
      `Toggle narrow intersection debug mode${topPosition ? ` at ${topPosition * 100}%` : ""}`,
    );
    // This will be implemented by individual consumers
    return true;
  };
}
