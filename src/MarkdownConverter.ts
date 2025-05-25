import React from "react";
import TurndownService from "turndown";
import type { XMLFile } from "./Epub";

// Types for Markdown conversion
export interface MarkdownConversionOptions {
  imageComponent?: string;
  footnoteComponent?: string;
  enableViewportDetection?: boolean;
  enableFootnoteHover?: boolean;
}

export interface ImageData {
  href: string;
  alt?: string;
  title?: string;
  width?: string;
  height?: string;
}

export interface FootnoteData {
  id: string;
  href: string;
  content: string;
  backref?: string;
}

export interface MarkdownResult {
  content: string;
  images: ImageData[];
  footnotes: FootnoteData[];
  title?: string;
}

// Custom Turndown rules for Markdown components
export class MarkdownTurndownService extends TurndownService {
  private footnoteCounter = 0;
  private footnotes: FootnoteData[] = [];
  private images: ImageData[] = [];

  constructor(options: MarkdownConversionOptions = {}) {
    super({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      emDelimiter: "*",
      strongDelimiter: "**",
    });

    this.setupImageRule(options.imageComponent || "Image");
    this.setupFootnoteRules(options.footnoteComponent || "Footnote");
    this.setupCleanupRules();
  }

  private setupImageRule(componentName: string) {
    this.addRule("images", {
      filter: "img",
      replacement: (content, node) => {
        const img = node as HTMLImageElement;
        const src = img.getAttribute("src") || "";
        const alt = img.getAttribute("alt") || "";
        const title = img.getAttribute("title");
        const width = img.getAttribute("width");
        const height = img.getAttribute("height");

        const imageData: ImageData = {
          href: src,
          alt,
          ...(title && { title }),
          ...(width && { width }),
          ...(height && { height }),
        };

        this.images.push(imageData);

        // Build props for component
        const props = [
          `href="${src}"`,
          alt && `alt="${alt}"`,
          title && `title="${title}"`,
          width && `width="${width}"`,
          height && `height="${height}"`,
        ]
          .filter(Boolean)
          .join(" ");

        return `<${componentName} ${props} />`;
      },
    });
  }

  private setupFootnoteRules(componentName: string) {
    // Handle footnote links (typically <a> tags with epub:type="noteref")
    this.addRule("footnote-links", {
      filter: (node) => {
        return !!(
          node.nodeName === "A" &&
          (node.getAttribute("epub:type") === "noteref" ||
            node.getAttribute("role") === "doc-noteref" ||
            node.getAttribute("href")?.startsWith("#"))
        );
      },
      replacement: (content, node) => {
        const link = node as HTMLAnchorElement;
        const href = link.getAttribute("href") || "";
        const id = href.replace("#", "");

        this.footnoteCounter++;
        const footnoteData: FootnoteData = {
          id,
          href,
          content: content.trim(),
        };

        this.footnotes.push(footnoteData);

        return `<${componentName} href="${href}" id="${id}">${content}</${componentName}>`;
      },
    });

    // Handle footnote content areas (typically <aside> or <div> with epub:type="footnote")
    this.addRule("footnote-content", {
      filter: (node) => {
        return (
          (node.nodeName === "ASIDE" || node.nodeName === "DIV") &&
          (node.getAttribute("epub:type") === "footnote" ||
            node.getAttribute("role") === "doc-footnote")
        );
      },
      replacement: () => "", // Remove footnote content from main text
    });
  }

  private setupCleanupRules() {
    // Remove common EPUB metadata elements
    this.addRule("remove-epub-metadata", {
      filter: ["head", "title", "meta", "link"],
      replacement: () => "",
    });

    // Clean up common EPUB structural elements
    this.addRule("clean-structure", {
      filter: (node) => {
        const className = node.getAttribute("class") || "";
        return (
          className.includes("calibre") ||
          className.includes("epub") ||
          node.getAttribute("epub:type") === "pagebreak"
        );
      },
      replacement: (content) => content,
    });
  }

  getCollectedData() {
    return {
      images: this.images,
      footnotes: this.footnotes,
    };
  }

  reset() {
    this.footnoteCounter = 0;
    this.footnotes = [];
    this.images = [];
  }
}

// Main converter class
export class MarkdownConverter {
  private turndownService: MarkdownTurndownService;
  private options: MarkdownConversionOptions;

  constructor(options: MarkdownConversionOptions = {}) {
    this.options = {
      imageComponent: "Image",
      footnoteComponent: "Footnote",
      enableViewportDetection: true,
      enableFootnoteHover: true,
      ...options,
    };

    this.turndownService = new MarkdownTurndownService(this.options);
  }

  async convertXMLFile(xmlFile: XMLFile): Promise<MarkdownResult> {
    // Reset service state
    this.turndownService.reset();

    // Extract title from the document
    const title = this.extractTitle(xmlFile.dom);

    // Get the body content or main content
    const bodyContent = this.extractMainContent(xmlFile.dom);

    // Convert to markdown with custom components
    const markdownContent = this.turndownService.turndown(bodyContent);

    // Get collected data
    const { images, footnotes } = this.turndownService.getCollectedData();

    // Post-process the markdown
    const processedContent = this.postProcessMarkdown(markdownContent);

    return {
      content: processedContent,
      images,
      footnotes,
      title,
    };
  }

  private extractTitle(dom: XMLDocument): string | undefined {
    // Try various selectors for title
    const titleSelectors = [
      "title",
      "h1",
      '[epub\\:type="title"]',
      ".title",
      "header h1",
      "header h2",
    ];

    for (const selector of titleSelectors) {
      const element = dom.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return undefined;
  }

  private extractMainContent(dom: XMLDocument): string {
    // Try to find the main content area
    const contentSelectors = [
      "body",
      "main",
      '[role="main"]',
      ".content",
      ".chapter",
      "article",
    ];

    for (const selector of contentSelectors) {
      const element = dom.querySelector(selector);
      if (element) {
        return element.innerHTML || "";
      }
    }

    // Fallback to entire document
    return dom.documentElement?.innerHTML || "";
  }

  private postProcessMarkdown(markdown: string): string {
    return (
      markdown
        // Clean up excessive whitespace
        .replace(/\n{3,}/g, "\n\n")
        // Remove empty lines at start/end
        .trim()
        // Fix spacing around components
        .replace(/\n(<[A-Z])/g, "\n\n$1")
        .replace(/(<\/[A-Z][^>]*>)\n/g, "$1\n\n")
    );
  }
}

// Context and provider types for React components
export interface EPubResolverContext {
  resolver: XMLFile;
  baseUrl?: string;
}

// React Context (to be used in your React components)
export const EPubResolverContext =
  React.createContext<EPubResolverContext | null>(null);

// Hook for accessing the resolver in components
export function useEPubResolver(): EPubResolverContext {
  const context = React.useContext(EPubResolverContext);
  if (!context) {
    throw new Error("useEPubResolver must be used within EPubResolverProvider");
  }
  return context;
}

// Utility functions for component implementations
export async function loadImageData(
  resolver: XMLFile,
  href: string,
): Promise<Uint8Array | undefined> {
  return await resolver.readRaw(href);
}

export function createImageDataUrl(data: Uint8Array, mimeType: string): string {
  const base64 = btoa(String.fromCharCode(...data));
  return `data:${mimeType};base64,${base64}`;
}

export async function resolveFootnoteContent(
  resolver: XMLFile,
  href: string,
): Promise<string | undefined> {
  // If href is a fragment identifier, we need to find it in the current document
  if (href.startsWith("#")) {
    const id = href.substring(1);
    const element = resolver.dom.getElementById(id);
    return element?.textContent?.trim();
  }

  // Otherwise, load the referenced file
  const content = await resolver.read(href);
  return content;
}

export function detectImageMimeType(href: string): string {
  const ext = href.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

// Export utility functions
export async function exportChapterAsMarkdown(
  xmlFile: XMLFile,
  options?: MarkdownConversionOptions,
): Promise<MarkdownResult> {
  const converter = new MarkdownConverter(options);
  return await converter.convertXMLFile(xmlFile);
}

export async function convertEPubToMarkdown(
  epubFiles: XMLFile[],
  options?: MarkdownConversionOptions,
): Promise<MarkdownResult[]> {
  const converter = new MarkdownConverter(options);
  const results: MarkdownResult[] = [];

  for (const file of epubFiles) {
    const result = await converter.convertXMLFile(file);
    results.push(result);
  }

  return results;
}
