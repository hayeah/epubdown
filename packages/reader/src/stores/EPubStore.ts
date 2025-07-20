import { EPub, type XMLFile } from "@epubdown/core";
import { action, makeObservable, observable } from "mobx";

export class EPubStore {
  epub: EPub | null = null;
  isLoading = false;
  error: string | null = null;
  currentChapterIndex = 0;
  chapters: XMLFile[] = [];
  metadata: Record<string, any> = {};

  constructor() {
    makeObservable(this, {
      epub: observable,
      isLoading: observable,
      error: observable,
      currentChapterIndex: observable,
      chapters: observable,
      metadata: observable,
      loadEpub: action,
      setCurrentChapter: action,
      nextChapter: action,
      previousChapter: action,
      reset: action,
    });
  }

  async loadEpub(file: File) {
    this.isLoading = true;
    this.error = null;

    try {
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
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load EPUB";
    } finally {
      this.isLoading = false;
    }
  }

  setCurrentChapter(index: number) {
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

  reset() {
    this.epub = null;
    this.isLoading = false;
    this.error = null;
    this.currentChapterIndex = 0;
    this.chapters = [];
    this.metadata = {};
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
}
