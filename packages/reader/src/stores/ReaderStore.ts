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
import type { CommandPaletteStore } from "../../command/CommandPaletteStore";
import type { Command } from "../../command/types";
import type { AppEventSystem } from "../app/context";
import type { EventPayload } from "../events/types";
import { markdownToReact } from "../markdownToReact";
import { ReaderTemplateContext } from "../templates/ReaderTemplateContext";
import type { ReaderTemplates } from "../templates/Template";
import { copyToClipboard, getSelectionContext } from "../utils/selectionUtils";
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
  private popoverRef: HTMLElement | null = null;

  // Converter
  converter: ContentToMarkdown | null = null;

  // Dependencies
  private navigate: NavigateFunction | null = null;

  // Cached state
  currentChapterRender: MarkdownResult | null = null;
  tocInfo: { navItems: FlatNavItem[] } | null = null;
  private labelByIndex: Map<number, string> = new Map();

  private templateContext: ReaderTemplateContext;

  constructor(
    private bookLibraryStore: BookLibraryStore,
    private events: AppEventSystem,
    private palette: CommandPaletteStore,
    private templates: ReaderTemplates,
  ) {
    this.templateContext = new ReaderTemplateContext(this, palette);

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
    });
  }

  setNavigate(navigate: NavigateFunction): void {
    this.navigate = navigate;
  }

  setupBindings(
    scope: "view" | "overlay:selectionPopover" | "overlay:sidebar",
    readerContainer?: HTMLElement,
    sidebarElement?: () => HTMLElement | null,
  ) {
    if (scope === "view") {
      return this.events.register([
        "view:reader", // Push the layer
        {
          id: "reader.copyWithContext",
          event: { kind: "key", combo: "meta+shift+c" },
          layer: "view:reader",
          when: () => !!this.currentChapterRender,
          run: () => this.copySelectionWithContext(),
        },
        {
          id: "reader.toggleSidebar",
          event: { kind: "key", combo: "meta+shift+s" },
          layer: "view:reader",
          when: () => !!this.epub,
          run: () => this.toggleSidebar(),
        },
        {
          id: "reader.selection.openPalette",
          event: { kind: "textSelect", container: readerContainer },
          layer: "view:reader",
          when: () => !!this.currentChapterRender && !!readerContainer,
          run: (payload) => {
            if (payload.kind !== "textSelect") return;
            const selected = payload.text.trim();
            if (!selected) return;
            const cmds = this.buildSelectionCommands(selected);
            this.palette.openSelection(cmds, { range: payload.range });
          },
        },
      ]);
    }

    if (scope === "overlay:sidebar" && sidebarElement) {
      return this.events.register([
        "overlay:sidebar",
        {
          id: "sidebar.close.bgClick",
          event: { kind: "bgClick", shield: sidebarElement },
          layer: "overlay:sidebar",
          when: () => this.isSidebarOpen,
          run: () => this.setSidebarOpen(false),
        },
      ]);
    }

    if (scope === "overlay:selectionPopover") {
      return this.events.register([
        "overlay:selectionPopover",
        {
          id: "selPopover.close.bgClick",
          event: { kind: "bgClick", shield: () => this.popoverRef },
          layer: "overlay:selectionPopover",
          run: () => {
            this.closePopover();
          },
        },
      ]);
    }

    return () => {};
  }

  private closePopover() {
    // Called from bg click event - currently handled by SelectionPopover component
    // This could be expanded to manage popover state if needed
  }

  setPopoverRef(ref: HTMLElement | null) {
    this.popoverRef = ref;
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
      const { navItems } = this.tocInfo;
      this.labelByIndex.clear();

      for (const navItem of navItems) {
        const chapterIndex = this.findChapterIndexByPath(navItem.path);
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

  async copySelectionWithContext() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    // Find the "copy" template
    const copyTemplate = this.templates.find((t) => t.id === "copy");
    if (!copyTemplate) {
      // Fallback to just copying the text
      copyToClipboard(selection.toString());
      return;
    }

    // Create context and render template
    const output = await copyTemplate.render(this.templateContext);
    copyToClipboard(output);
  }

  private buildSelectionCommands(selected: string): Command[] {
    const commands: Command[] = [];

    // Generate commands from templates
    for (const def of this.templates) {
      commands.push({
        id: def.id,
        label: def.title,
        scope: "context",
        action: async () => {
          this.palette.restoreSelection();
          const output = await def.render(this.templateContext);
          copyToClipboard(output);
        },
      });
    }

    return commands;
  }

  // Navigation methods
  async handleUrlChange(location: string): Promise<void> {
    // Parse the location to extract bookId, chapterIndex, and fragment
    const [pathname, fragment] = location.split("#");
    const match = pathname?.match(/\/book\/([^\/]+)(?:\/(\d+))?/);
    if (!match || !match[1]) return;

    const bookId = Number(match[1]);
    const chapterIndex = match[2] ? Number(match[2]) : undefined;

    // Load book and chapter
    await this.loadBookAndChapter(bookId, chapterIndex);

    // Close sidebar on mobile after navigation
    this.setSidebarOpen(false);

    // Handle fragment scrolling after chapter loads
    if (fragment) {
      setTimeout(() => {
        const element = document.getElementById(fragment);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  }

  handleChapterChange(index: number) {
    if (this.currentBookId && this.navigate) {
      this.navigate(`/book/${this.currentBookId}/${index}`);
    }
  }

  handleTocChapterSelect(path: string) {
    if (!this.currentBookId || !this.navigate) return;

    // Find chapter index from path
    const chapterIndex = this.findChapterIndexByPath(path);
    if (chapterIndex !== -1) {
      this.navigate(`/book/${this.currentBookId}/${chapterIndex}`);
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

  // TOC-related utilities
  async getTocInfo() {
    if (!this.epub) return null;

    const navItems = await this.epub.toc.flatNavItems();

    return { navItems };
  }

  async getChapterTitleFromToc(chapterPath: string): Promise<string | null> {
    if (!this.epub || !chapterPath) return null;

    const tocInfo = await this.getTocInfo();
    if (!tocInfo) return null;

    const { navItems } = tocInfo;

    // Find matching nav item for the chapter
    const matchingItem = navItems.find((item) => {
      return chapterPath === item.path;
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

  findChapterIndexByPath(path: string): number {
    return this.chapters.findIndex((chapter) => chapter.path === path);
  }

  /**
   * Converts an EPUB-rooted absolute path to a reader application URL.
   *
   * EPUB files use absolute paths from the root (e.g., "/OEBPS/chapter1.xhtml#section2")
   * to reference other chapters. This method converts those paths to the reader's
   * URL format which uses book ID and chapter index (e.g., "/book/123/4#section2").
   *
   * @param href - The EPUB-rooted absolute path, possibly URL-encoded and with fragment
   * @returns The reader URL if the chapter is found, null otherwise
   *
   * @example
   * // Input: "/OEBPS/chapter1.xhtml#section2"
   * // Output: "/book/123/4#section2" (where 123 is book ID, 4 is chapter index)
   *
   * @example
   * // Input: "/OEBPS/ch%201.xhtml" (URL-encoded space)
   * // Output: "/book/123/2" (decodes to "/OEBPS/ch 1.xhtml" before lookup)
   */
  rootedHrefToBookHref(href: string): string | null {
    if (!this.currentBookId) return null;

    // Decode the URL first
    const decodedHref = decodeURIComponent(href);

    // Split into path and fragment
    const [pathPart, fragment] = decodedHref.split("#");

    // Find chapter index for the path
    const chapterIndex = this.findChapterIndexByPath(pathPart || "");

    if (chapterIndex === -1) return null;

    // Build the reader URL
    const fragmentPart = fragment ? `#${fragment}` : "";
    return `/book/${this.currentBookId}/${chapterIndex}${fragmentPart}`;
  }

  private async firstTocChapterIndex(): Promise<number> {
    await this.loadTocOnce();

    if (!this.tocInfo?.navItems?.length) {
      return 0;
    }

    for (const navItem of this.tocInfo.navItems) {
      if (!navItem.path) continue;

      const chapterIndex = this.findChapterIndexByPath(navItem.path);
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
