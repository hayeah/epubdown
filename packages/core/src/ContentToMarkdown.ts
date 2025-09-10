import TurndownService from "turndown";
import type { DOMFile } from "./DOMFile";
import { normalizePath } from "./utils/normalizePath";

export interface ConversionOptions {
  keepIds?: Set<string>;
  basePath?: string;
}

interface TurndownFactoryOptions {
  keepIds?: Set<string>;
  basePath?: string;
}

function createTurndownService(
  options?: TurndownFactoryOptions,
): TurndownService {
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

  static create(options?: ConversionOptions): ContentToMarkdown {
    const td = createTurndownService(options);
    const instance = new ContentToMarkdown(td);
    // Store basePath for DOM normalization; keepIds intentionally unused for now
    instance._basePath = options?.basePath;
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
}
