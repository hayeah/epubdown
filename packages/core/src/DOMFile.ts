import { basename, dirname, join } from "node:path";
import type { DataResolver } from "./resolvers/DataResolver";
import { querySelectorNamespaced } from "./utils/querySelectorNamespaced";
import { parseDocument } from "./xmlParser";

export type ContentType = "xml" | "html" | "xhtml";

// Map a media-type string (e.g. application/xhtml+xml) or a shorthand
// (xml|html|xhtml) to a DOMFile ContentType. Defaults to xhtml in EPUB context.
function normalizeContentType(input: string): ContentType {
  const value = input.toLowerCase().trim();
  if (value === "xml" || value === "html" || value === "xhtml") {
    return value as ContentType;
  }
  if (value.includes("application/xhtml+xml")) return "xhtml";
  if (value.includes("text/html")) return "html";
  if (
    value.includes("application/xml") ||
    value.includes("text/xml") ||
    value.includes("application/oebps-package+xml") ||
    value.includes("application/x-dtbncx+xml")
  ) {
    return "xml";
  }
  // Default in EPUB context
  return "xhtml";
}

/**
 * Detect content type based on file extension and MIME type patterns
 */
function detectContentType(href: string, content?: string): ContentType {
  const lowerHref = href.toLowerCase();

  // Strong signals from file extension
  if (lowerHref.endsWith(".xhtml") || lowerHref.endsWith(".xhtm")) {
    return "xhtml";
  }
  if (
    lowerHref.endsWith(".xml") ||
    lowerHref.endsWith(".opf") ||
    lowerHref.endsWith(".ncx") ||
    lowerHref.includes("container.xml")
  ) {
    return "xml";
  }

  // Heuristic for .html files that are actually XHTML
  if (lowerHref.endsWith(".html") || lowerHref.endsWith(".htm")) {
    const sample = (content || "").slice(0, 2048).toLowerCase();
    if (
      sample.includes("<?xml") ||
      sample.includes('<!doctype html public "-//w3c//dtd xhtml') ||
      sample.includes('xmlns="http://www.w3.org/1999/xhtml"') ||
      sample.includes("xml:lang=")
    ) {
      return "xhtml";
    }
    return "html";
  }

  // Default to xhtml for unknown extensions in EPUB context
  return "xhtml";
}

export class DOMFile {
  constructor(
    public readonly base: string,
    public readonly name: string,
    public readonly content: string,
    public readonly dom: Document,
    public readonly contentType: string,
  ) {}

  get path() {
    const relativePath = join(this.base, this.name);
    // Ensure the path always starts with /
    return relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  }

  static async load(
    absHref: string,
    resolver: DataResolver,
    contentType?: string,
  ): Promise<DOMFile | undefined> {
    if (!absHref.startsWith("/")) {
      throw new Error(`Absolute path required, got: ${absHref}`);
    }

    const content = await resolver.read(absHref);
    if (!content) {
      return undefined;
    }

    let actualContentType = contentType || detectContentType(absHref, content);
    actualContentType = normalizeContentType(actualContentType);

    const dom = parseDocument(content, actualContentType);
    const newBase = dirname(absHref);
    const name = basename(absHref);

    return new DOMFile(newBase, name, content, dom, actualContentType);
  }

  querySelector(selector: string): Element | null {
    return this.dom.querySelector(selector);
  }

  querySelectorAll(selector: string): NodeListOf<Element> {
    return this.dom.querySelectorAll(selector);
  }

  /**
   * Query selector helper for namespaced attributes that works across different browser environments
   * @param tag - The tag name to search for
   * @param attribute - The attribute to match (e.g., 'type="toc"')
   * @param ns - Optional namespace prefix (e.g., 'epub')
   * @returns The first matching element or null
   */
  querySelectorNamespaced(
    tag: string,
    attribute: string,
    ns?: string | null,
  ): Element | null {
    return querySelectorNamespaced(this.dom, tag, attribute, ns);
  }
}
