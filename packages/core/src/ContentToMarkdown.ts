import TurndownService from "turndown";
import type { XMLFile } from "./XMLFile";
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
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
  });

  // Apply all rules
  addMetadataRemovalRules(td);
  addImageConversionRules(td);

  if (options?.keepIds && options.keepIds.size > 0) {
    addIdPreservationRules(td, options.keepIds);
  }

  if (options?.basePath) {
    addLinkNormalizationRules(td, options.basePath);
    addImageNormalizationRules(td, options.basePath);
  }

  return td;
}

function addImageConversionRules(td: TurndownService): void {
  // Convert img tags to x-image elements
  td.addRule("convert-img-to-x-image", {
    filter: "img",
    replacement: (content, node) => {
      const element = node as HTMLImageElement;
      const src = element.getAttribute("src");
      const alt = element.getAttribute("alt");

      if (!src) return "";

      // Build x-image element with attributes
      const attributes = [`src="${src}"`];
      if (alt !== null) {
        attributes.push(`alt="${alt}"`);
      }

      // IMPORTANT: Use explicit closing tag instead of self-closing
      // html-react-parser doesn't recognize custom tags as void elements
      // and will incorrectly parse subsequent content as children
      return `<x-image ${attributes.join(" ")}></x-image>`;
    },
  });
}

function addMetadataRemovalRules(td: TurndownService): void {
  // Remove common EPUB metadata elements
  td.addRule("remove-epub-metadata", {
    filter: ["head", "title", "meta", "link"],
    replacement: () => "",
  });

  // Remove style tags to prevent CSS content from appearing in markdown
  td.addRule("remove-style-tags", {
    filter: ["style"],
    replacement: () => "",
  });

  // Remove script tags for security and cleanliness
  td.addRule("remove-script-tags", {
    filter: ["script"],
    replacement: () => "",
  });
}

function addIdPreservationRules(
  td: TurndownService,
  keepIds: Set<string>,
): void {
  // Add high-priority rule to preserve IDs on headings
  td.addRule("preserve-heading-ids", {
    filter: (node) => {
      if (!["H1", "H2", "H3", "H4", "H5", "H6"].includes(node.nodeName)) {
        return false;
      }
      const id = (node as Element).getAttribute?.("id");
      return !!(id && keepIds.has(id));
    },
    replacement: (content, node) => {
      const element = node as Element;
      const id = element.getAttribute?.("id");
      if (!id) return content;

      // Get the heading level
      const level = Number.parseInt(element.nodeName.charAt(1));
      const hashes = "#".repeat(level);

      // Insert a span with the ID before the heading
      return `<span id="${id}"></span>${hashes} ${content}`;
    },
  });

  // Add rule to preserve other IDs
  td.addRule("preserve-other-ids", {
    filter: (node) => {
      // Skip headings as they're handled above
      if (["H1", "H2", "H3", "H4", "H5", "H6"].includes(node.nodeName)) {
        return false;
      }
      const id = (node as Element).getAttribute?.("id");
      return !!(id && keepIds.has(id));
    },
    replacement: (content, node) => {
      const id = (node as Element).getAttribute?.("id");
      if (!id) return content;

      // Insert a span with the ID before the content
      return `<span id="${id}"></span>${content}`;
    },
  });
}

function addLinkNormalizationRules(
  td: TurndownService,
  basePath: string,
): void {
  // Add rule to normalize internal links to absolute paths
  td.addRule("normalize-a-href", {
    filter: "a",
    replacement: (content, node) => {
      const element = node as HTMLAnchorElement;
      const href = element.getAttribute("href");

      if (!href) {
        return content;
      }

      // Use normalizePath which handles all special cases
      const absolutePath = normalizePath(basePath, href);
      // Encode the path for use in markdown links
      const encodedPath = encodeURI(absolutePath);
      return `[${content}](${encodedPath})`;
    },
  });
}

function addImageNormalizationRules(
  td: TurndownService,
  basePath: string,
): void {
  // Override the image conversion rule to also normalize paths
  td.addRule("normalize-img-src", {
    filter: "img",
    replacement: (content, node) => {
      const element = node as HTMLImageElement;
      const src = element.getAttribute("src");
      const alt = element.getAttribute("alt");

      if (!src) return "";

      // Normalize the image path if it's not an external URL
      let normalizedSrc = src;
      if (!/^(https?:|data:|blob:)/i.test(src)) {
        normalizedSrc = normalizePath(basePath, src);
      }

      // Build x-image element with normalized src
      const attributes = [`src="${normalizedSrc}"`];
      if (alt !== null) {
        attributes.push(`alt="${alt}"`);
      }

      return `<img ${attributes.join(" ")}/>`;
    },
  });
}

export class ContentToMarkdown {
  constructor(private readonly turndownService: TurndownService) {}

  static create(options?: ConversionOptions): ContentToMarkdown {
    const td = createTurndownService(options);
    return new ContentToMarkdown(td);
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

  async convertXMLFile(xmlFile: XMLFile): Promise<string> {
    // Transform SVG images to regular img tags before passing to Turndown
    this.transformSvgImages(xmlFile.dom);

    // Pass the body element from the XMLFile DOM to TurndownService
    const body = xmlFile.dom.querySelector("body");
    const elementToConvert = body || xmlFile.dom.documentElement;

    const result = this.turndownService.turndown(elementToConvert as any);
    return result;
  }
}
