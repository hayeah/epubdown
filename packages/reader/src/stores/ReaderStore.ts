import {
  ContentToMarkdown,
  EPub,
  type FlatNavItem,
  type XMLFile,
} from "@epubdown/core";
import {
  action,
  computed,
  makeObservable,
  observable,
  runInAction,
} from "mobx";
import { markdownToReact } from "../markdownToReact";
import { resolveTocHref } from "../utils/pathUtils";
import {
  copyToClipboard,
  formatSelectionWithContext,
  getSelectionContext,
} from "../utils/selectionUtils";
import type { BookLibraryStore } from "./BookLibraryStore";

export interface MarkdownResult {
  markdown: string;
  reactTree: React.ReactNode;
}

export type NavigateFunction = (path: string) => void;

export class ReaderStore {
  // EPub state
  epub: EPub | null = null;
  chapters: XMLFile[] = [];
  metadata: Record<string, any> = {};
  currentChapterIndex = 0;
  currentBookId: number | null = null;

  // UI state
  isSidebarOpen = false;

  // Converter
  converter: ContentToMarkdown | null = null;

  // Dependencies
  private navigate: NavigateFunction | null = null;

  // Cached state
  currentChapterRender: MarkdownResult | null = null;
  tocInfo: { navItems: FlatNavItem[]; tocBase: string } | null = null;
  private labelByIndex: Map<number, string> = new Map();

  constructor(private bookLibraryStore: BookLibraryStore) {
    makeObservable(this, {
      epub: observable,
      chapters: observable,
      metadata: observable,
      currentChapterIndex: observable,
      currentBookId: observable,
      isSidebarOpen: observable,
      converter: observable,
      currentChapterRender: observable.ref,
      tocInfo: observable.ref,
      handleLoadBook: action,
      setChapter: action,
      nextChapter: action,
      previousChapter: action,
      reset: action,
      loadBookAndChapter: action,
      setSidebarOpen: action,
      toggleSidebar: action,
      handleUrlChange: action,
      handleChapterChange: action,
      handleTocChapterSelect: action,
      updatePageTitle: action,
      currentChapter: computed,
      hasNextChapter: computed,
      hasPreviousChapter: computed,
      currentChapterTitle: computed,
      navItems: computed,
      tocBase: computed,
    });
  }

  setNavigate(navigate: NavigateFunction): void {
    this.navigate = navigate;
  }

  private async convertCurrentChapter() {
    const chapter = this.currentChapter;
    if (!chapter || !this.converter) return;
    const markdown = await this.converter.convertXMLFile(chapter);
    const reactTree = await markdownToReact(markdown);
    runInAction(() => {
      this.currentChapterRender = { markdown, reactTree };
    });
  }

  private async loadTocOnce() {
    if (!this.epub || this.tocInfo) return;
    this.tocInfo = await this.getTocInfo();

    // Build the spine-index → label cache
    if (this.tocInfo) {
      const { navItems, tocBase } = this.tocInfo;
      this.labelByIndex.clear();

      for (const navItem of navItems) {
        const resolvedPath = resolveTocHref(tocBase, navItem.href);
        const chapterIndex = this.findChapterIndexByHref(navItem.href);
        if (chapterIndex !== -1) {
          this.labelByIndex.set(chapterIndex, navItem.label);
        }
      }
    }
  }

  async handleLoadBook(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const epub = await EPub.fromZip(arrayBuffer);

    // Load chapters
    const chapterArray: XMLFile[] = [];
    for await (const chapter of epub.chapters()) {
      chapterArray.push(chapter);
    }

    runInAction(() => {
      this.epub = epub;
      this.chapters = chapterArray;
      this.metadata = epub.metadata.toJSON();
      // Initialize converter
      this.converter = ContentToMarkdown.create();
    });

    // Load TOC once per book
    await this.loadTocOnce();

    // Set initial chapter to first TOC chapter
    const firstTocIndex = await this.firstTocChapterIndex();
    runInAction(() => {
      this.currentChapterIndex = firstTocIndex;
    });

    // Convert the current chapter
    await this.convertCurrentChapter();
  }

  async setChapter(index: number) {
    if (index >= 0 && index < this.chapters.length) {
      this.currentChapterIndex = index;
      // Update page title when chapter changes
      this.updatePageTitle();
      // Convert the new chapter
      await this.convertCurrentChapter();
    }
  }

  nextChapter() {
    if (this.currentChapterIndex < this.chapters.length - 1) {
      this.currentChapterIndex++;
    }
  }

  previousChapter() {
    if (this.currentChapterIndex > 0) {
      this.currentChapterIndex--;
    }
  }

  async getImage(resolver: XMLFile, href: string): Promise<string> {
    const imageData = await resolver.readRaw(href);
    if (!imageData) {
      throw new Error("Image not found");
    }

    // Detect mime type from file extension
    const ext = href.split(".").pop()?.toLowerCase();
    const mimeType =
      ext === "png"
        ? "image/png"
        : ext === "gif"
          ? "image/gif"
          : ext === "webp"
            ? "image/webp"
            : ext === "svg"
              ? "image/svg+xml"
              : "image/jpeg";

    const base64 = btoa(
      Array.from(imageData).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        "",
      ),
    );
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return dataUrl;
  }

  async getFootnote(resolver: XMLFile, href: string): Promise<string> {
    // Check if href has a fragment identifier
    const hashIndex = href.indexOf("#");
    let targetHref = href;
    let fragmentId = "";

    if (hashIndex !== -1) {
      targetHref = href.substring(0, hashIndex);
      fragmentId = href.substring(hashIndex + 1);
    }

    // If the href is just a fragment, read from the current file
    let content: string | undefined;
    if (targetHref === "" || targetHref === resolver.name) {
      content = resolver.content;
    } else {
      // Otherwise, resolve and read the target file
      const targetFile = await resolver.readXMLFile(targetHref);
      content = targetFile?.content;
    }

    if (!content) {
      throw new Error("Footnote file not found");
    }

    // Extract footnote content from HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");

    let footnoteContent = "";
    if (fragmentId) {
      const element = doc.getElementById(fragmentId);
      if (element) {
        footnoteContent = element.textContent || "";
      }
    } else {
      // Get all text content if no fragment
      footnoteContent = doc.body.textContent || "";
    }

    return footnoteContent.trim();
  }

  reset() {
    this.epub = null;
    this.currentChapterIndex = 0;
    this.chapters = [];
    this.metadata = {};
    this.converter = null;
    this.currentBookId = null;
    this.isSidebarOpen = false;
    this.currentChapterRender = null;
    this.tocInfo = null;
    this.labelByIndex.clear();
  }

  // UI state management
  setSidebarOpen(isOpen: boolean) {
    this.isSidebarOpen = isOpen;
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  copySelectionWithContext() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const context = getSelectionContext(selection);
    const formatted = formatSelectionWithContext(
      this.metadata.title || "Unknown Book",
      context,
    );
    copyToClipboard(formatted);
  }

  // Navigation methods
  async handleUrlChange(location: string): Promise<void> {
    // Parse the location to extract bookId and chapterIndex
    const match = location.match(/\/book\/([^\/]+)(?:\/(\d+))?/);
    if (!match || !match[1]) return;

    const bookId = Number(match[1]);
    const chapterIndex = match[2] ? Number(match[2]) : undefined;

    // Load book and chapter
    await this.loadBookAndChapter(bookId, chapterIndex);
  }

  handleChapterChange(index: number) {
    if (this.currentBookId && this.navigate) {
      this.navigate(`/book/${this.currentBookId}/${index}`);
    }
  }

  handleTocChapterSelect(href: string) {
    if (!this.currentBookId || !this.navigate) return;

    // Find chapter index from href
    const chapterIndex = this.findChapterIndexByHref(href);
    if (chapterIndex !== -1) {
      this.navigate(`/book/${this.currentBookId}/${chapterIndex}`);
      this.setSidebarOpen(false); // Close sidebar on mobile after selection
    }
  }

  async loadBookAndChapter(
    bookId: number,
    chapterIndex?: number,
  ): Promise<void> {
    // Check if we're loading a different book
    const isNewBook = this.currentBookId !== bookId;

    // Only load book if it's different from current
    if (isNewBook) {
      this.reset();

      const bookData = await this.bookLibraryStore.loadBookForReading(bookId);
      if (!bookData) {
        throw new Error("Book not found");
      }

      // Convert Blob to File for ReaderStore
      const file = new File(
        [bookData.blob],
        `${bookData.metadata.title}.epub`,
        {
          type: "application/epub+zip",
        },
      );

      await this.handleLoadBook(file);
      runInAction(() => {
        this.currentBookId = bookId;
      });
    }

    // Determine target chapter index
    const targetChapterIndex =
      chapterIndex !== undefined
        ? chapterIndex
        : await this.firstTocChapterIndex();

    // Check if we're already at the requested book and chapter
    if (!isNewBook && this.currentChapterIndex === targetChapterIndex) {
      return; // No need to update
    }

    // Set chapter only if different
    if (this.currentChapterIndex !== targetChapterIndex) {
      await this.setChapter(targetChapterIndex);
    } else if (isNewBook) {
      // If it's a new book but same chapter index, still need to convert
      await this.convertCurrentChapter();
    }

    // Update page title after loading book/chapter
    await this.updatePageTitle();
  }

  // Computed getters
  get currentChapter() {
    return this.chapters[this.currentChapterIndex] || null;
  }

  get hasNextChapter() {
    return this.currentChapterIndex < this.chapters.length - 1;
  }

  get hasPreviousChapter() {
    return this.currentChapterIndex > 0;
  }

  get currentChapterTitle() {
    return this.chapterLabel(this.currentChapterIndex);
  }

  get navItems() {
    return this.tocInfo?.navItems ?? [];
  }

  get tocBase() {
    return this.tocInfo?.tocBase ?? "";
  }

  // TOC-related utilities
  async getTocInfo() {
    if (!this.epub) return null;

    const navItems = await this.epub.toc.flatNavItems();
    const tocFile = await this.epub.toc.html();
    const tocBase = tocFile?.base || "";

    return { navItems, tocBase };
  }

  async getChapterTitleFromToc(chapterPath: string): Promise<string | null> {
    if (!this.epub || !chapterPath) return null;

    const tocInfo = await this.getTocInfo();
    if (!tocInfo) return null;

    const { navItems, tocBase } = tocInfo;

    // Find matching nav item for the chapter
    const matchingItem = navItems.find((item) => {
      const resolvedPath = resolveTocHref(tocBase, item.href);
      return (
        chapterPath === resolvedPath ||
        (resolvedPath && chapterPath.endsWith(resolvedPath))
      );
    });

    return matchingItem?.label || null;
  }

  private chapterLabel(idx: number): string | null {
    if (!this.labelByIndex.size) return null;

    // Check for exact match first
    const exactMatch = this.labelByIndex.get(idx);
    if (exactMatch !== undefined) {
      return exactMatch;
    }

    // Walk backwards to find the nearest earlier chapter with a label
    for (let i = idx - 1; i >= 0; i--) {
      const label = this.labelByIndex.get(i);
      if (label !== undefined) {
        // Memoize this result for future lookups
        this.labelByIndex.set(idx, label);
        return label;
      }
    }

    return null;
  }

  findChapterIndexByHref(href: string): number {
    const hrefPath = href.split("#")[0] || "";
    const tocBasePath = this.epub?.opf.base || "";

    return this.chapters.findIndex((chapter) => {
      const resolvedHref = hrefPath?.startsWith("/")
        ? hrefPath
        : `${tocBasePath}/${hrefPath}`.replace(/\/+/g, "/");

      return (
        chapter.path === resolvedHref ||
        (hrefPath ? chapter.path.endsWith(hrefPath) : false)
      );
    });
  }

  private async firstTocChapterIndex(): Promise<number> {
    await this.loadTocOnce();

    if (!this.tocInfo?.navItems?.length) {
      return 0;
    }

    for (const navItem of this.tocInfo.navItems) {
      if (!navItem.href) continue;

      const chapterIndex = this.findChapterIndexByHref(navItem.href);
      if (chapterIndex !== -1) {
        return chapterIndex;
      }
    }

    return 0;
  }

  async updatePageTitle(): Promise<void> {
    if (!this.epub || !this.currentChapter) return;

    // Get chapter title using the new chapterLabel method
    const chapterTitle = this.chapterLabel(this.currentChapterIndex);
    const bookTitle = this.metadata.title || "Unknown Book";

    // Update document title
    if (chapterTitle) {
      document.title = `${chapterTitle} | ${bookTitle}`;
    } else {
      // If no chapter label found, only show book title
      document.title = bookTitle;
    }
  }
}
