import { EPub, ContentToMarkdown } from "@epubdown/core";
import type { BridgeAPI, BookHandle, LoadedBook, MetadataResult } from "./types.ts";

const books = new Map<BookHandle, LoadedBook>();
let nextHandle = 1;

async function resolveSpine(epub: EPub) {
  const items = epub.spineWithManifest();
  return items.map((item) => ({
    path: item.manifestItem?.path ?? item.idref,
    href: item.manifestItem?.href ?? item.idref,
  }));
}

export const bridge: BridgeAPI = {
  async loadBook(arrayBuffer: ArrayBuffer): Promise<BookHandle> {
    const epub = await EPub.fromZip(arrayBuffer);
    const spine = await resolveSpine(epub);
    const handle = nextHandle++;
    books.set(handle, { epub, spine });
    return handle;
  },

  async getMetadata(handle: BookHandle): Promise<MetadataResult> {
    const book = books.get(handle);
    if (!book) throw new Error(`Unknown book handle: ${handle}`);
    const meta = book.epub.metadata;
    return meta.toJSON() as MetadataResult;
  },

  async getTOC(handle: BookHandle) {
    const book = books.get(handle);
    if (!book) throw new Error(`Unknown book handle: ${handle}`);
    return book.epub.toc.flatNavItems();
  },

  getChapterCount(handle: BookHandle): number {
    const book = books.get(handle);
    if (!book) throw new Error(`Unknown book handle: ${handle}`);
    return book.spine.length;
  },

  async getChapterHTML(handle: BookHandle, index: number): Promise<string> {
    const book = books.get(handle);
    if (!book) throw new Error(`Unknown book handle: ${handle}`);
    const spineItem = book.spine[index];
    if (!spineItem) throw new Error(`Chapter index out of range: ${index}`);
    const chapter = await book.epub.getChapter(spineItem.path);
    if (!chapter) throw new Error(`Failed to load chapter: ${spineItem.path}`);
    return chapter.content;
  },

  async getChapterMarkdown(handle: BookHandle, index: number): Promise<string> {
    const book = books.get(handle);
    if (!book) throw new Error(`Unknown book handle: ${handle}`);
    const spineItem = book.spine[index];
    if (!spineItem) throw new Error(`Chapter index out of range: ${index}`);
    return book.epub.chapterMarkdown(spineItem.path);
  },

  async renderChapter(handle: BookHandle, index: number): Promise<void> {
    const html = await bridge.getChapterHTML(handle, index);
    // Dispatch to React via a custom event
    window.dispatchEvent(
      new CustomEvent("epubbridge:renderchapter", {
        detail: { handle, index, html },
      }),
    );
  },
};

// Expose globally for Swift's evaluateJavaScript
window.epubBridge = bridge;
