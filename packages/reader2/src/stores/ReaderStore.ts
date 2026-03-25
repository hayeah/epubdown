import {
  ContentToMarkdown,
  type DOMFile,
  EPub,
  type FlatNavItem,
  normalizePath,
} from "@epubdown/core";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
import type { LibraryRegistry } from "./LibraryRegistry";

export type NavigateFunction = (path: string) => void;

export class ReaderStore {
  epub: EPub | null = null;
  chapters: DOMFile[] = [];
  metadata: Record<string, any> = {};
  currentChapterIndex = 0;
  currentBookId: number | null = null;
  isSidebarOpen = false;
  tocInfo: { navItems: FlatNavItem[] } | null = null;
  private labelByIndex: Map<number, string> = new Map();
  private navigate: NavigateFunction | null = null;

  constructor(private libraryRegistry: LibraryRegistry) {
    makeObservable(this, {
      epub: observable,
      chapters: observable,
      metadata: observable,
      currentChapterIndex: observable,
      currentBookId: observable,
      isSidebarOpen: observable,
      tocInfo: observable.ref,
      setChapter: action,
      nextChapter: action,
      previousChapter: action,
      reset: action,
      setSidebarOpen: action,
      toggleSidebar: action,
      handleChapterChange: action,
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

  async loadBookAndChapter(bookId: number, chapterIndex?: number): Promise<void> {
    const isNewBook = this.currentBookId !== bookId;

    if (isNewBook) {
      this.reset();
      const bookData = await this.libraryRegistry.loadBookById(bookId);
      if (!bookData) throw new Error("Book not found");

      const file = new File([bookData.blob], `${bookData.metadata.title}.epub`, {
        type: "application/epub+zip",
      });

      const arrayBuffer = await file.arrayBuffer();
      const epub = await EPub.fromZip(arrayBuffer);

      const chapterArray: DOMFile[] = [];
      for await (const chapter of epub.chapters()) {
        chapterArray.push(chapter);
      }

      runInAction(() => {
        this.epub = epub;
        this.chapters = chapterArray;
        this.metadata = epub.metadata.toJSON();
        this.currentBookId = bookId;
      });

      await this.loadTocOnce();
    }

    const targetChapterIndex =
      chapterIndex !== undefined ? chapterIndex : await this.firstTocChapterIndex();

    if (this.currentChapterIndex !== targetChapterIndex) {
      this.setChapter(targetChapterIndex);
    }

    this.updatePageTitle();
  }

  setChapter(index: number) {
    if (index >= 0 && index < this.chapters.length) {
      this.currentChapterIndex = index;
      this.updatePageTitle();
    }
  }

  nextChapter() {
    if (this.hasNextChapter) {
      this.currentChapterIndex++;
      this.updatePageTitle();
    }
  }

  previousChapter() {
    if (this.hasPreviousChapter) {
      this.currentChapterIndex--;
      this.updatePageTitle();
    }
  }

  handleChapterChange(index: number) {
    if (this.currentBookId && this.navigate) {
      this.navigate(`/book/${this.currentBookId}/${index}`);
    }
  }

  handleTocChapterSelect(path: string) {
    if (!this.navigate) return;
    const url = this.rootedHrefToBookHref(path);
    if (url) this.navigate(url);
  }

  rootedHrefToBookHref(href: string): string | null {
    if (!this.currentBookId) return null;
    const decodedHref = decodeURIComponent(href);
    const [pathPart, fragment] = decodedHref.split("#");
    const chapterIndex = this.findChapterIndexByPath(pathPart || "");
    if (chapterIndex === -1) return null;
    const fragmentPart = fragment ? `#${fragment}` : "";
    return `/book/${this.currentBookId}/${chapterIndex}${fragmentPart}`;
  }

  async getFootnote(chapter: DOMFile, href: string): Promise<string> {
    const decoded = decodeURIComponent(href || "");
    const [maybePath, fragment] = decoded.split("#");
    const filePath =
      !maybePath || maybePath === chapter.name
        ? chapter.path
        : maybePath.startsWith("/")
          ? maybePath
          : normalizePath(chapter.base, maybePath);

    const target =
      filePath === chapter.path
        ? chapter.content
        : (await this.epub?.readDOMFile(filePath))?.content;
    if (!target) throw new Error("Footnote file not found");

    const parser = new DOMParser();
    const doc = parser.parseFromString(target, "text/html");

    if (fragment) {
      const element = doc.getElementById(fragment);
      return element?.textContent?.trim() || "";
    }
    return doc.body.textContent?.trim() || "";
  }

  async getChapterMarkdown(): Promise<string> {
    const chapter = this.currentChapter;
    if (!chapter) return "";
    const converter = ContentToMarkdown.create({ basePath: chapter.base });
    return await converter.convertXMLFile(chapter);
  }

  reset() {
    this.epub = null;
    this.currentChapterIndex = 0;
    this.chapters = [];
    this.metadata = {};
    this.currentBookId = null;
    this.isSidebarOpen = false;
    this.tocInfo = null;
    this.labelByIndex.clear();
  }

  setSidebarOpen(isOpen: boolean) {
    this.isSidebarOpen = isOpen;
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

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

  findChapterIndexByPath(path: string): number {
    const pathWithoutAnchor = path.split("#")[0] || path;
    return this.chapters.findIndex((chapter) => chapter.path === pathWithoutAnchor);
  }

  private async loadTocOnce() {
    if (!this.epub || this.tocInfo) return;
    const navItems = await this.epub.toc.flatNavItems();

    this.labelByIndex.clear();
    for (const navItem of navItems) {
      const chapterIndex = this.findChapterIndexByPath(navItem.path);
      if (chapterIndex !== -1) {
        this.labelByIndex.set(chapterIndex, navItem.label);
      }
    }

    runInAction(() => {
      this.tocInfo = { navItems };
    });
  }

  private chapterLabel(idx: number): string | null {
    if (!this.labelByIndex.size) return null;
    const exactMatch = this.labelByIndex.get(idx);
    if (exactMatch !== undefined) return exactMatch;
    for (let i = idx - 1; i >= 0; i--) {
      const label = this.labelByIndex.get(i);
      if (label !== undefined) {
        this.labelByIndex.set(idx, label);
        return label;
      }
    }
    return null;
  }

  private async firstTocChapterIndex(): Promise<number> {
    await this.loadTocOnce();
    if (!this.tocInfo?.navItems?.length) return 0;
    for (const navItem of this.tocInfo.navItems) {
      if (!navItem.path) continue;
      const chapterIndex = this.findChapterIndexByPath(navItem.path);
      if (chapterIndex !== -1) return chapterIndex;
    }
    return 0;
  }

  private updatePageTitle(): void {
    if (!this.epub || !this.currentChapter) return;
    const chapterTitle = this.chapterLabel(this.currentChapterIndex);
    const bookTitle = this.metadata.title || "Unknown Book";
    document.title = chapterTitle ? `${chapterTitle} | ${bookTitle}` : bookTitle;
  }
}
