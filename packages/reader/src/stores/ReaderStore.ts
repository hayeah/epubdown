import { ContentToMarkdown, EPub, type XMLFile } from "@epubdown/core";
import { action, computed, makeObservable, observable } from "mobx";
import { markdownToReact } from "../markdownToReact";

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

  // Converter
  converter: ContentToMarkdown | null = null;

  constructor() {
    makeObservable(this, {
      epub: observable,
      chapters: observable,
      metadata: observable,
      currentChapterIndex: observable,
      converter: observable,
      loadBook: action,
      setChapter: action,
      nextChapter: action,
      previousChapter: action,
      reset: action,
      currentChapter: computed,
      hasNextChapter: computed,
      hasPreviousChapter: computed,
    });
  }

  async loadBook(file: File) {
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

    const markdown = await this.converter.convertXMLFile(xmlFile);
    const reactTree = await markdownToReact(markdown);

    return { markdown, reactTree };
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
