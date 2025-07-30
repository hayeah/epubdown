/**
 * ReadingProgressStore uses IntersectionObserver to track reading progress.
 *
 * Why we use a narrow intersection window (1% height):
 *
 * If the intersection window is large, there's an asymmetry in which element is
 * considered "intersecting" depending on scroll direction:
 * - When scrolling UP: the element entering from the TOP is matched
 * - When scrolling DOWN: the element entering from the BOTTOM is matched
 *
 * With a large window, these two elements could be far apart even though the
 * actual scroll distance is small, giving a sense of instability.
 *
 * The solution is to use a narrow window (1% of viewport height) positioned at
 * a specific point (default 20% from top) to mimic where the reader's eyes
 * typically fall.
 *
 * IMPORTANT: When restoring scroll position, the element must be scrolled to
 * exactly where the intersection window is. The scroll offset MUST match the
 * window position for consistent behavior.
 */
export class ReadingProgressStore {
  private observer: IntersectionObserver | null = null;
  private blocks: Element[] = [];
  private indexMap: Map<Element, number> = new Map();
  private contentEl: HTMLElement | null = null;
  public debugMode = false;
  private currentBlockIndex: number | null = null;
  private debugBox: HTMLDivElement | null = null;

  constructor(
    private options = {
      // Position of the narrow intersection window from the top of viewport (0-1)
      // This represents where the reader's eyes typically fall when reading
      top: 0.2, // 20% from top
      blockSelector:
        "p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, table",
    },
  ) {}

  setup(contentEl: HTMLElement): void {
    this.stopTracking();
    this.contentEl = contentEl;
    this.blocks = this.extractBlocks(contentEl);

    // Build index map
    this.indexMap.clear();
    this.blocks.forEach((block, index) => {
      this.indexMap.set(block, index);
    });
  }

  // Getters for calculated values based on the top position
  private get scrollOffset(): number {
    // The scroll offset must match the top position of the intersection window
    // This ensures elements are scrolled to exactly where they'll be tracked
    return window.innerHeight * this.options.top;
  }

  private get rootMargin(): string {
    // Create a narrow 1% window at the specified top position
    // Format: "<top> <right> <bottom> <left>"
    const topMargin = -(this.options.top * 100); // negative percentage from top
    const bottomMargin = -((1 - this.options.top - 0.01) * 100); // leave 1% window
    return `${topMargin}% 0px ${bottomMargin}% 0px`;
  }

  private get debugBoxStyles(): Partial<CSSStyleDeclaration> {
    return {
      position: "fixed",
      top: `${this.options.top * 100}%`,
      left: "0",
      right: "0",
      height: "1%", // The narrow window height
      border: "2px dashed red",
      background: "rgba(255, 0, 0, 0.05)",
      pointerEvents: "none",
      zIndex: "999999",
    };
  }

  // Initialize tracking for content container
  startTracking(contentEl: HTMLElement): void {
    // Create observer
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = this.indexMap.get(entry.target);
            if (index !== undefined) {
              this.currentBlockIndex = index;
              this.updateUrlHash(index);

              if (this.debugMode) {
                this.updateDebugVisuals();
              }
            }
          }
        });
      },
      {
        rootMargin: this.rootMargin,
        threshold: 0,
      },
    );

    // Observe all blocks
    this.blocks.forEach((block) => {
      this.observer?.observe(block);
    });
  }

  // Clean up observer
  stopTracking(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.blocks = [];
    this.indexMap.clear();
    this.contentEl = null;
    this.currentBlockIndex = null;

    if (this.debugMode) {
      this.clearDebugVisuals();
    }
  }

  // Restore scroll position from hash
  restoreScrollPosition(hash: string = location.hash): void {
    const position = this.parsePositionHash(hash);
    if (position !== null && position > 0 && this.blocks.length > position) {
      const target = this.blocks[position];
      if (target && "scrollIntoView" in target) {
        // First scroll to the element
        (target as HTMLElement).scrollIntoView({
          block: "start",
          behavior: "instant",
        });

        // Then adjust scroll position to place the element exactly at the intersection window
        // This MUST match the window position for consistent tracking behavior
        window.scrollBy(0, -this.scrollOffset);
      }
    }
  }

  // Get blocks by index for scroll restoration
  getBlockByIndex(index: number): Element | undefined {
    return this.blocks[index];
  }

  // Parse reading position from hash
  parsePositionHash(hash: string): number | null {
    const match = hash.match(/#p_(\d+)$/);
    return match?.[1] ? Number.parseInt(match[1], 10) : null;
  }

  // Format position to hash
  formatPositionHash(position: number): string {
    return `#p_${position}`;
  }

  // Update URL hash
  updateUrlHash(position: number): void {
    const hash = location.hash;
    const currentPosMatch = hash.match(/#p_\d+$/);
    const currentChapterPart = currentPosMatch
      ? hash.substring(0, hash.lastIndexOf("#p_"))
      : hash;
    const newHash = `${currentChapterPart}${this.formatPositionHash(position)}`;
    history.replaceState(null, "", newHash);
  }

  // Get current tracked blocks
  getBlocks(): Element[] {
    return [...this.blocks];
  }

  // Extract blocks from container
  private extractBlocks(contentEl: HTMLElement): Element[] {
    const blocks: Element[] = [];
    const blockSelector = this.options.blockSelector;

    // Only check direct children of the content container
    for (const child of contentEl.children) {
      if (child.matches(blockSelector)) {
        blocks.push(child);
      }
    }

    return blocks;
  }

  // Debug mode methods
  showDebugBox(): void {
    if (this.debugBox) return;

    this.debugBox = document.createElement("div");
    Object.assign(this.debugBox.style, this.debugBoxStyles);
    document.body.appendChild(this.debugBox);
  }

  hideDebugBox(): void {
    if (this.debugBox) {
      document.body.removeChild(this.debugBox);
      this.debugBox = null;
    }
  }

  updateDebugVisuals(): void {
    // Clear previous debug styles
    this.clearDebugVisuals();

    // Highlight current block
    if (
      this.currentBlockIndex !== null &&
      this.blocks[this.currentBlockIndex]
    ) {
      const currentBlock = this.blocks[this.currentBlockIndex] as HTMLElement;
      currentBlock.style.border = "2px solid rgba(0, 0, 255, 0.5)";
      currentBlock.style.background = "rgba(0, 0, 255, 0.05)";
    }
  }

  clearDebugVisuals(): void {
    // Clear all debug styles from blocks
    this.blocks.forEach((block) => {
      const el = block as HTMLElement;
      el.style.border = "";
      el.style.background = "";
    });
  }
}

// Singleton instance
let readingProgressStore: ReadingProgressStore | null = null;

// Hook to access the singleton store
export function useReadingProgress(): ReadingProgressStore {
  if (!readingProgressStore) {
    readingProgressStore = new ReadingProgressStore();

    // Add debug toggle function to window
    if (typeof window !== "undefined") {
      (window as any).toggleReadingProgressDebug = () => {
        if (!readingProgressStore) return false;

        readingProgressStore.debugMode = !readingProgressStore.debugMode;
        console.log(
          `Reading progress debug mode: ${readingProgressStore.debugMode ? "ON" : "OFF"}`,
        );

        if (readingProgressStore.debugMode) {
          readingProgressStore.showDebugBox();
          readingProgressStore.updateDebugVisuals();
        } else {
          readingProgressStore.hideDebugBox();
          readingProgressStore.clearDebugVisuals();
        }

        return readingProgressStore.debugMode;
      };
    }
  }
  return readingProgressStore;
}
