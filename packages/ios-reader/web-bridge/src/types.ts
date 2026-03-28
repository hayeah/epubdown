import type { EPub } from "@epubdown/core";
import type { FlatNavItem } from "@epubdown/core";

export type BookHandle = number;

export interface MetadataResult {
  title: string;
  author: string;
  language: string;
  [key: string]: string;
}

export interface BridgeAPI {
  /** Load an EPUB from raw bytes. Returns a numeric handle. */
  loadBook(arrayBuffer: ArrayBuffer): Promise<BookHandle>;

  /** Get book metadata as a flat key→value map. */
  getMetadata(handle: BookHandle): Promise<MetadataResult>;

  /** Get flattened table of contents. */
  getTOC(handle: BookHandle): Promise<FlatNavItem[]>;

  /** Get the number of chapters (spine items). */
  getChapterCount(handle: BookHandle): number;

  /** Get chapter HTML content as a string. */
  getChapterHTML(handle: BookHandle, index: number): Promise<string>;

  /** Get chapter content converted to Markdown. */
  getChapterMarkdown(handle: BookHandle, index: number): Promise<string>;

  /** Render a chapter into the content area. Returns when rendering is complete. */
  renderChapter(handle: BookHandle, index: number): Promise<void>;
}

/** Stored book instance with its parsed chapters */
export interface LoadedBook {
  epub: EPub;
  /** Spine items with resolved paths */
  spine: Array<{ path: string; href: string }>;
}

declare global {
  interface Window {
    epubBridge: BridgeAPI;
    webkit?: {
      messageHandlers: {
        scroll?: { postMessage(data: unknown): void };
        link?: { postMessage(data: unknown): void };
        ready?: { postMessage(data: unknown): void };
        bridge?: { postMessage(data: unknown): void };
      };
    };
  }
}
