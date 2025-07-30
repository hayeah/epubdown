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
import { benchmark } from "../utils/benchmark";
import { resolveTocHref } from "../utils/pathUtils";
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
  currentBookId: string | null = null;

  // UI state
  isSidebarOpen = false;

  // Converter
  converter: ContentToMarkdown | null = null;

  // Dependencies
  private bookLibraryStore: BookLibraryStore | null = null;
  private navigate: NavigateFunction | null = null;

  constructor() {
    makeObservable(this, {
      epub: observable,
      chapters: observable,
      metadata: observable,
      currentChapterIndex: observable,
      currentBookId: observable,
      isSidebarOpen: observable,
      converter: observable,
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
      currentChapter: computed,
      hasNextChapter: computed,
      hasPreviousChapter: computed,
    });
  }

  setBookLibraryStore(bookLibraryStore: BookLibraryStore): void {
    this.bookLibraryStore = bookLibraryStore;
  }

  setNavigate(navigate: NavigateFunction): void {
    this.navigate = navigate;
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
      this.currentChapterIndex = 0;
      // Initialize converter
      this.converter = ContentToMarkdown.create();
    });
  }

  setChapter(index: number) {
    if (index >= 0 && index < this.chapters.length) {
      this.currentChapterIndex = index;
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

  async getChapterReactTree(xmlFile: XMLFile): Promise<MarkdownResult> {
    if (!this.converter) {
      throw new Error("Converter not initialized");
    }

    const converter = this.converter;
    const result = await benchmark(
      `getChapterReactTree: ${xmlFile.path}`,
      async () => {
        const markdown = await benchmark(
          `convertXMLFile: ${xmlFile.path}`,
          converter.convertXMLFile(xmlFile),
        );

        const reactTree = await benchmark(
          "markdownToReact",
          markdownToReact(markdown),
        );

        return { markdown, reactTree };
      },
    );

    return result;
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
  }

  // UI state management
  setSidebarOpen(isOpen: boolean) {
    this.isSidebarOpen = isOpen;
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  // Navigation methods
  async handleUrlChange(location: string): Promise<void> {
    // Parse the location to extract bookId and chapterIndex
    const match = location.match(/\/book\/([^\/]+)(?:\/(\d+))?/);
    if (!match || !match[1]) return;

    const bookId = match[1];
    const chapterIndex = match[2] ? Number(match[2]) : 0;

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
    bookId: string,
    chapterIndex: number,
  ): Promise<void> {
    if (!this.bookLibraryStore) {
      throw new Error("BookLibraryStore not set");
    }

    // Check if we're already at the requested book and chapter
    if (
      this.currentBookId === bookId &&
      this.currentChapterIndex === chapterIndex
    ) {
      return; // No need to update
    }

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

    // Set chapter only if different
    if (this.currentChapterIndex !== chapterIndex) {
      this.setChapter(chapterIndex);
    }
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
}
