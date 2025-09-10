import TurndownService from "turndown";
import type { DOMFile } from "./DOMFile";
import { normalizePath } from "./utils/normalizePath";

export interface ConversionOptions {
  preserveIDs?: boolean;
  basePath?: string;
}

function createTurndownService(): TurndownService {
  // Minimal Turndown configuration; no custom rules that mutate DOM
  return new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
  });
}

export class ContentToMarkdown {
  constructor(private readonly turndownService: TurndownService) {}

  // Base path used for normalizing relative resource URLs in the DOM
  private _basePath?: string;
  private _preserveIDs?: boolean;

  static create(options?: ConversionOptions): ContentToMarkdown {
    const td = createTurndownService();
    const instance = new ContentToMarkdown(td);
    instance._basePath = options?.basePath;
    instance._preserveIDs = options?.preserveIDs;

    // Keep anchor divs as raw HTML so IDs survive
    if (options?.preserveIDs) {
      td.addRule("preserve-anchor-divs", {
        filter: (node) => {
          // IMPORTANT: nodeName comparison must be case-insensitive
          // In XHTML documents (like EPUBs), nodeName can be lowercase
          const nodeName = node.nodeName.toUpperCase();
          return (
            nodeName === "DIV" &&
            (node as Element).hasAttribute("data-anchor-ids")
          );
        },
        replacement: (_content, node) => {
          // Preserve the original div HTML exactly as-is
          const div = node as Element;
          const ids = div.getAttribute("data-anchor-ids");
          if (ids) {
            return `<div data-anchor-ids="${ids}">\u200B</div>\n\n`;
          }
          return "";
        },
      });
    }

    return instance;
  }

  private transformSvgImages(dom: Document): void {
    const SVG_NS = "http://www.w3.org/2000/svg";

    // Find all SVG elements
    const svgElements = dom.getElementsByTagNameNS(SVG_NS, "svg");
    const svgsToProcess: Element[] = Array.from(svgElements);

    // Also look for svg: prefixed elements
    const svgPrefixedElements = dom.querySelectorAll("svg\\:svg");
    svgsToProcess.push(...Array.from(svgPrefixedElements));

    for (const svg of svgsToProcess) {
      // Look for image elements within the SVG
      const images = svg.getElementsByTagNameNS(SVG_NS, "image");
      const imagesToProcess: Element[] = Array.from(images);

      // Also look for svg:image elements
      const svgPrefixedImages = svg.querySelectorAll("svg\\:image");
      imagesToProcess.push(...Array.from(svgPrefixedImages));

      for (const image of imagesToProcess) {
        // Get the href attribute (could be xlink:href or href)
        const href =
          image.getAttribute("xlink:href") ||
          image.getAttribute("href") ||
          image.getAttributeNS("http://www.w3.org/1999/xlink", "href");

        if (href) {
          // Create a regular img element
          const img = dom.createElement("img");
          img.setAttribute("src", href);
          img.setAttribute("alt", "_[SVG cover image not supported]_");

          // Replace the SVG with the img element
          if (svg.parentNode) {
            svg.parentNode.insertBefore(img, svg);
          }
        }
      }

      // Remove the SVG element after processing
      if (svg.parentNode) {
        svg.parentNode.removeChild(svg);
      }
    }
  }

  async convertXMLFile(xmlFile: DOMFile): Promise<string> {
    // Transform SVG images to regular img tags before passing to Turndown
    this.transformSvgImages(xmlFile.dom);

    // DOM-first transforms prior to Turndown conversion
    this.transformDocument(xmlFile.dom);

    // Pass the body element from the DOMFile DOM to TurndownService
    const body = xmlFile.dom.querySelector("body");
    const elementToConvert = body || xmlFile.dom.documentElement;

    const result = this.turndownService.turndown(elementToConvert as any);
    return result;
  }

  // Apply a sequence of DOM-first transforms
  private transformDocument(doc: Document): Document {
    this.removeMetadataElements(doc);
    if (this._preserveIDs) this.insertIdAnchors(doc);
    this.normalizeHeadings(doc);
    this.normalizeLinkHrefs(doc);
    this.normalizeImageSources(doc);
    return doc;
  }

  private removeMetadataElements(doc: Document): void {
    for (const n of doc.querySelectorAll(
      'meta, script, style, link[rel="stylesheet"], head [name], head [property], head [itemprop]',
    )) {
      n.remove();
    }
    for (const n of doc.querySelectorAll(
      'nav[hidden], nav[aria-hidden="true"]',
    )) {
      n.remove();
    }
  }

  private normalizeHeadings(doc: Document): void {
    // Find all heading elements (h1-h6)
    const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");

    for (const heading of headings) {
      // Extract any images before simplifying the heading
      const images = heading.querySelectorAll("img");
      const extractedImages: Element[] = [];

      for (const img of images) {
        extractedImages.push(img.cloneNode(true) as Element);
      }

      // Flatten the heading to just text content
      const textContent = heading.textContent?.trim() || "";
      heading.textContent = textContent;

      // Insert extracted images after the heading
      if (extractedImages.length > 0) {
        const imageContainer = doc.createElement("div");
        for (const img of extractedImages) {
          imageContainer.appendChild(img);
        }

        if (heading.nextSibling) {
          heading.parentNode?.insertBefore(imageContainer, heading.nextSibling);
        } else {
          heading.parentNode?.appendChild(imageContainer);
        }
      }
    }
  }

  private normalizeLinkHrefs(doc: Document): void {
    for (const a of doc.querySelectorAll("a[href]")) {
      const raw = a.getAttribute("href") ?? "";
      if (!raw || raw.startsWith("#")) continue;
      a.setAttribute("href", this.normalizeResourcePath(raw));
    }
  }

  private normalizeImageSources(doc: Document): void {
    for (const img of doc.querySelectorAll("img[src]")) {
      const raw = img.getAttribute("src") ?? "";
      if (!raw) continue;
      img.setAttribute("src", this.normalizeResourcePath(raw));
      // Only set fallback alt if alt attribute is missing entirely
      if (!img.hasAttribute("alt")) {
        const filename = raw.split("/").pop() ?? "";
        if (filename) img.setAttribute("alt", filename);
      }
    }
  }

  private normalizeResourcePath(href: string): string {
    // Leave absolute paths, fragments, and external/data/blob URIs untouched
    if (
      href.startsWith("/") ||
      href.startsWith("#") ||
      /^(https?:|data:|blob:)/i.test(href)
    ) {
      return href;
    }
    const base = this._basePath ?? "/";
    return normalizePath(base, href);
  }

  /**
   * Extracts IDs from block-level elements and inserts them as invisible anchor divs.
   * This preserves element IDs in the markdown output while keeping them invisible.
   * 
   * For each block element with an ID (or containing elements with IDs), this function:
   * 1. Collects all IDs from the element and its descendants
   * 2. Removes the ID attributes from the original elements
   * 3. Creates/updates an invisible div before the element with data-anchor-ids attribute
   * 
   * Example input:
   *   <h2 id="chapter-1">Chapter Title</h2>
   *   <p id="intro">Some text with <span id="ref-1">reference</span></p>
   * 
   * Example output:
   *   <div data-anchor-ids="chapter-1" style="display:none"></div>
   *   <h2>Chapter Title</h2>
   *   <div data-anchor-ids="intro ref-1" style="display:none"></div>
   *   <p>Some text with <span>reference</span></p>
   *
   */
  private insertIdAnchors(doc: Document): void {
    // Get all block containers
    const heads = Array.from(doc.querySelectorAll("h1,h2,h3,h4,h5,h6"));
    const paras = Array.from(doc.querySelectorAll("p"));
    const divs = Array.from(doc.querySelectorAll("div"));

    const containers: Element[] = [...heads, ...paras];

    // Only include divs that don't contain p elements
    for (const div of divs) {
      if (!div.querySelector("p")) {
        containers.push(div);
      }
    }

    // Process each container
    for (const container of containers) {
      // Collect all IDs from this container and its descendants
      const idsToPreserve: string[] = [];

      // Check container itself
      if (container.hasAttribute("id")) {
        const id = container.getAttribute("id");
        if (id) {
          idsToPreserve.push(id);
        }
        container.removeAttribute("id");
      }

      // Find all elements with IDs inside this container
      const elementsWithIds = container.querySelectorAll("[id]");
      for (const el of elementsWithIds) {
        const id = el.getAttribute("id");
        if (id) {
          idsToPreserve.push(id);
          el.removeAttribute("id");
        }
      }

      // If we found any IDs, create or update anchor div
      if (idsToPreserve.length > 0 && container.parentNode) {
        // Check if there's already an anchor div before this container
        const prev = container.previousSibling;
        if (
          prev &&
          prev.nodeType === 1 &&
          (prev as Element).tagName.toLowerCase() === "div" &&
          (prev as Element).hasAttribute("data-anchor-ids")
        ) {
          // Add to existing anchor div
          const existingIds =
            (prev as Element).getAttribute("data-anchor-ids") || "";
          const ids = existingIds ? existingIds.split(" ") : [];
          ids.push(...idsToPreserve);
          (prev as Element).setAttribute("data-anchor-ids", ids.join(" "));
        } else {
          // Create new anchor div
          const anchorDiv = doc.createElement("div");
          anchorDiv.setAttribute("data-anchor-ids", idsToPreserve.join(" "));
          anchorDiv.textContent = "\u200B"; // Zero-width space to ensure it's not empty
          container.parentNode.insertBefore(anchorDiv, container);
        }
      }
    }
  }
}
