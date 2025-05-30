import { action, computed, makeObservable, observable } from "mobx";
import { EPubMarkdownConverter } from "../EPubMarkdownConverter";
import type { EPub, XMLFile } from "../Epub";
import { markdownToReact } from "../markdownToReact";

export interface MarkdownResult {
  markdown: string;
  reactTree: React.ReactNode;
}

export class ChapterStore {
  markdownResults = new Map<string, MarkdownResult>();
  loadingChapters = new Set<string>();
  errors = new Map<string, string>();

  converter: EPubMarkdownConverter | null = null;

  constructor() {
    makeObservable(this, {
      markdownResults: observable.ref,
      loadingChapters: observable,
      errors: observable,
      converter: observable,
      setConverter: action,
      loadChapter: action,
      clearCache: action,
      clearChapter: action,
      cachedChapterCount: computed,
    });
  }

  setConverter(epub: EPub) {
    this.converter = new EPubMarkdownConverter(epub);
  }

  async loadChapter(xmlFile: XMLFile): Promise<MarkdownResult | null> {
    const key = xmlFile.path;

    // Return cached result if available
    if (this.markdownResults.has(key)) {
      return this.markdownResults.get(key) || null;
    }

    // Already loading
    if (this.loadingChapters.has(key)) {
      return null;
    }

    if (!this.converter) {
      this.errors.set(key, "Converter not initialized");
      return null;
    }

    this.loadingChapters.add(key);
    this.errors.delete(key);

    try {
      const htmlContent = xmlFile.content;
      const markdown = await this.converter.convertHtmlToMarkdown(
        htmlContent,
        xmlFile,
      );
      const reactTree = await markdownToReact(markdown);

      const result: MarkdownResult = { markdown, reactTree };
      this.markdownResults.set(key, result);
      return result;
    } catch (err) {
      this.errors.set(
        key,
        err instanceof Error ? err.message : "Failed to convert chapter",
      );
      return null;
    } finally {
      this.loadingChapters.delete(key);
    }
  }

  clearCache() {
    this.markdownResults.clear();
    this.loadingChapters.clear();
    this.errors.clear();
  }

  clearChapter(path: string) {
    this.markdownResults.delete(path);
    this.loadingChapters.delete(path);
    this.errors.delete(path);
  }

  getChapterResult(path: string): MarkdownResult | null {
    return this.markdownResults.get(path) || null;
  }

  isChapterLoading(path: string): boolean {
    return this.loadingChapters.has(path);
  }

  getChapterError(path: string): string | null {
    return this.errors.get(path) || null;
  }

  get cachedChapterCount(): number {
    return this.markdownResults.size;
  }
}
