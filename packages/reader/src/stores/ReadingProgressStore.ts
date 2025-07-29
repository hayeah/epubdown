export class ReadingProgressStore {
  private observer: IntersectionObserver | null = null;
  private blocks: Element[] = [];
  private indexMap: Map<Element, number> = new Map();
  private contentEl: HTMLElement | null = null;

  constructor(
    private options = {
      rootMargin: "0px 0px -80% 0px",
      threshold: 0,
      blockSelector:
        "p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, table",
    },
  ) {}

  // Initialize tracking for content container
  startTracking(contentEl: HTMLElement): void {
    this.stopTracking();
    this.contentEl = contentEl;
    this.blocks = this.extractBlocks(contentEl);

    // Build index map
    this.indexMap.clear();
    this.blocks.forEach((block, index) => {
      this.indexMap.set(block, index);
    });

    // Create observer
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = this.indexMap.get(entry.target);
            if (index !== undefined) {
              this.updateUrlHash(index);
            }
          }
        });
      },
      {
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold,
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
  }

  // Restore scroll position from hash
  restoreScrollPosition(hash: string = location.hash): void {
    const position = this.parsePositionHash(hash);
    if (position !== null && position > 0 && this.blocks.length > position) {
      const target = this.blocks[position];
      if (target && "scrollIntoView" in target) {
        (target as HTMLElement).scrollIntoView({
          block: "start",
          behavior: "instant",
        });
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
}

// Singleton instance
let readingProgressStore: ReadingProgressStore | null = null;

// Hook to access the singleton store
export function useReadingProgress(): ReadingProgressStore {
  if (!readingProgressStore) {
    readingProgressStore = new ReadingProgressStore();
  }
  return readingProgressStore;
}
