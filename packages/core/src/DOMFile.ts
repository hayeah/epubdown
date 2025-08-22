import { basename, dirname, join } from "node:path";
import { DataResolver } from "./resolvers/DataResolver";
import { normalizePath } from "./utils/normalizePath";
import { querySelectorNamespaced } from "./utils/querySelectorNamespaced";
import { parseDocument } from "./xmlParser";

export type ContentType = "xml" | "html" | "xhtml";

export class DOMFile extends DataResolver {
  constructor(
    public readonly base: string,
    public readonly name: string,
    public readonly content: string,
    public readonly dom: Document,
    public readonly resolver: DataResolver,
    public readonly contentType: ContentType = "xml",
  ) {
    super(base);
  }

  get path() {
    const relativePath = join(this.base, this.name);
    // Ensure the path always starts with /
    return relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  }

  static async load(
    href: string,
    resolver: DataResolver,
    contentType?: ContentType,
  ): Promise<DOMFile | undefined> {
    const content = await resolver.read(href);
    if (!content) {
      return undefined;
    }

    // Determine content type based on file extension if not provided
    const detectedContentType = contentType || DOMFile.detectContentType(href);

    const dom = parseDocument(content, detectedContentType);
    const fullPath = normalizePath(resolver.base, href);
    const newBase = dirname(fullPath);
    const name = basename(href);

    return new DOMFile(
      newBase,
      name,
      content,
      dom,
      resolver.rebase(newBase),
      detectedContentType,
    );
  }

  async readRaw(href: string): Promise<Uint8Array | undefined> {
    return this.resolver.readRaw(href);
  }

  async read(href: string): Promise<string | undefined> {
    return this.resolver.read(href);
  }

  createInstance(base: string): DataResolver {
    // throw new Error("Not implemented");
    return this.resolver.createInstance(base);
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

  /**
   * Detect content type based on file extension and MIME type patterns
   */
  static detectContentType(href: string): ContentType {
    const lowerHref = href.toLowerCase();

    // Check for HTML/XHTML extensions
    if (lowerHref.endsWith(".html") || lowerHref.endsWith(".htm")) {
      return "html";
    }
    if (lowerHref.endsWith(".xhtml") || lowerHref.endsWith(".xhtm")) {
      return "xhtml";
    }

    // Check for known XML files
    if (
      lowerHref.endsWith(".xml") ||
      lowerHref.endsWith(".opf") ||
      lowerHref.endsWith(".ncx") ||
      lowerHref.includes("container.xml")
    ) {
      return "xml";
    }

    // Default to xhtml for unknown extensions in EPUB context
    return "xhtml";
  }
}
