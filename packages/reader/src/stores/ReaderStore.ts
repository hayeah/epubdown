import { ContentToMarkdown, EPub, type XMLFile } from "@epubdown/core";
import { action, computed, makeObservable, observable } from "mobx";
import { markdownToReact } from "../markdownToReact";
import { benchmark } from "../utils/benchmark";
import type { BookLibraryStore } from "./BookLibraryStore";

export interface MarkdownResult {
  markdown: string;
  reactTree: React.ReactNode;
}

export class ReaderStore {
  // EPub state
  epub: EPub | null = null;
  chapters: XMLFile[] = [];
  metadata: Record<string, any> = {};
  currentChapterIndex = 0;
  currentBookId: string | null = null;

  // Converter
  converter: ContentToMarkdown | null = null;

  constructor() {
    makeObservable(this, {
      epub: observable,
      chapters: observable,
      metadata: observable,
      currentChapterIndex: observable,
      currentBookId: observable,
      converter: observable,
      handleLoadBook: action,
      setChapter: action,
      nextChapter: action,
      previousChapter: action,
      reset: action,
      handleChapterChange: action,
      handleTocChapterSelect: action,
      handleCloseBook: action,
      loadBookFromLibrary: action,
      currentChapter: computed,
      hasNextChapter: computed,
      hasPreviousChapter: computed,
    });
  }

  async handleLoadBook(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const epub = await EPub.fromZip(arrayBuffer);
    this.epub = epub;

    // Load chapters
    const chapterArray: XMLFile[] = [];
    for await (const chapter of epub.chapters()) {
      chapterArray.push(chapter);
    }
    this.chapters = chapterArray;

    this.metadata = epub.metadata.toJSON();
    this.currentChapterIndex = 0;

    // Initialize converter
    this.converter = ContentToMarkdown.create();
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

    const result = await benchmark(`getChapterReactTree: ${xmlFile.path}`, async () => {
      const markdown = await benchmark(
        `convertXMLFile: ${xmlFile.path}`,
        this.converter.convertXMLFile(xmlFile),
      );

      const reactTree = await benchmark(
        "markdownToReact",
        markdownToReact(markdown),
      );

      return { markdown, reactTree };
    });

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
  }

  handleChapterChange(
    navigate: (path: string, options?: { replace?: boolean }) => void,
    bookId: string,
    index: number,
  ) {
    navigate(`/book/${bookId}/${index}`, {
      replace: true,
    });
    this.setChapter(index);
  }

  handleTocChapterSelect(
    navigate: (path: string, options?: { replace?: boolean }) => void,
    bookId: string,
    href: string,
  ) {
    // Extract the file path without anchor
    const filePath = href.split("#")[0];

    // Find the chapter index by matching the path
    const chapterIndex = this.chapters.findIndex((chapter) => {
      // Compare the relative paths
      const chapterPath = chapter.path;
      const tocBasePath = this.epub?.opf.base || "";

      // Simple path resolution - might need adjustment based on actual epub structure
      const resolvedHref = filePath?.startsWith("/")
        ? filePath
        : `${tocBasePath}/${filePath}`.replace(/\/+/g, "/");

      return (
        chapterPath === resolvedHref ||
        (filePath ? chapterPath.endsWith(filePath) : false)
      );
    });

    if (chapterIndex !== -1) {
      navigate(`/book/${bookId}/${chapterIndex}`, {
        replace: true,
      });
      this.setChapter(chapterIndex);
      return true; // Indicate successful navigation
    }
    return false; // Indicate navigation failed
  }

  handleCloseBook(navigate: (path: string) => void) {
    this.reset();
    navigate("/");
  }

  async loadBookFromLibrary(
    navigate: (path: string) => void,
    bookId: string,
    bookLibraryStore: BookLibraryStore,
    initialChapter?: number,
  ) {
    // Check if we're loading a different book
    const isNewBook = this.currentBookId !== bookId;

    // Only reset if loading a different book to prevent flash during chapter changes
    if (isNewBook) {
      this.reset();

      const bookData = await bookLibraryStore.loadBookForReading(bookId);
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
      this.currentBookId = bookId;
    }

    // Set initial chapter
    const chapterToLoad = initialChapter || 0;
    this.setChapter(chapterToLoad);
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
}
