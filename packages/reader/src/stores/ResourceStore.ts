import type { XMLFile } from "@epubdown/core";
import { action, makeObservable, observable } from "mobx";

export class ResourceStore {
  images = new Map<string, string>(); // href -> dataUrl
  footnotes = new Map<string, string>(); // href -> content
  loadingResources = new Set<string>();
  errors = new Map<string, string>();

  constructor() {
    makeObservable(this, {
      images: observable.ref,
      footnotes: observable.ref,
      loadingResources: observable,
      errors: observable,
      loadImage: action,
      loadFootnote: action,
      clearCache: action,
      clearImagesForChapter: action,
      clearFootnotesForChapter: action,
    });
  }

  async loadImage(resolver: XMLFile, href: string): Promise<string | null> {
    const key = `${resolver.path}:${href}`;

    // Return cached result if available
    if (this.images.has(key)) {
      return this.images.get(key) || null;
    }

    // Already loading
    if (this.loadingResources.has(key)) {
      return null;
    }

    this.loadingResources.add(key);
    this.errors.delete(key);

    try {
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

      this.images.set(key, dataUrl);
      return dataUrl;
    } catch (err) {
      this.errors.set(
        key,
        err instanceof Error ? err.message : "Failed to load image",
      );
      return null;
    } finally {
      this.loadingResources.delete(key);
    }
  }

  async loadFootnote(resolver: XMLFile, href: string): Promise<string | null> {
    const key = `${resolver.path}:${href}`;

    // Return cached result if available
    if (this.footnotes.has(key)) {
      return this.footnotes.get(key) || null;
    }

    // Already loading
    if (this.loadingResources.has(key)) {
      return null;
    }

    this.loadingResources.add(key);
    this.errors.delete(key);

    try {
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

      this.footnotes.set(key, footnoteContent.trim());
      return footnoteContent.trim();
    } catch (err) {
      this.errors.set(
        key,
        err instanceof Error ? err.message : "Failed to load footnote",
      );
      return null;
    } finally {
      this.loadingResources.delete(key);
    }
  }

  clearCache() {
    this.images.clear();
    this.footnotes.clear();
    this.loadingResources.clear();
    this.errors.clear();
  }

  clearImagesForChapter(chapterPath: string) {
    const keysToDelete: string[] = [];
    for (const key of this.images.keys()) {
      if (key.startsWith(`${chapterPath}:`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.images.delete(key);
      this.errors.delete(key);
    }
  }

  clearFootnotesForChapter(chapterPath: string) {
    const keysToDelete: string[] = [];
    for (const key of this.footnotes.keys()) {
      if (key.startsWith(`${chapterPath}:`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.footnotes.delete(key);
      this.errors.delete(key);
    }
  }

  getImage(resolver: XMLFile, href: string): string | null {
    const key = `${resolver.path}:${href}`;
    return this.images.get(key) || null;
  }

  getFootnote(resolver: XMLFile, href: string): string | null {
    const key = `${resolver.path}:${href}`;
    return this.footnotes.get(key) || null;
  }

  isLoading(resolver: XMLFile, href: string): boolean {
    const key = `${resolver.path}:${href}`;
    return this.loadingResources.has(key);
  }

  getError(resolver: XMLFile, href: string): string | null {
    const key = `${resolver.path}:${href}`;
    return this.errors.get(key) || null;
  }
}
