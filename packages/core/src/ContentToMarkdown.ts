import TurndownService from "turndown";
import type { XMLFile } from "./Epub";

export interface ConversionOptions {
  keepIds?: Set<string>;
}

interface TurndownFactoryOptions {
  keepIds?: Set<string>;
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

  if (options?.keepIds && options.keepIds.size > 0) {
    addIdPreservationRules(td, options.keepIds);
  }

  return td;
}

function addMetadataRemovalRules(td: TurndownService): void {
  // Remove common EPUB metadata elements
  td.addRule("remove-epub-metadata", {
    filter: ["head", "title", "meta", "link"],
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

export class ContentToMarkdown {
  constructor(private readonly turndownService: TurndownService) {}

  static create(options?: ConversionOptions): ContentToMarkdown {
    const td = createTurndownService(options);
    return new ContentToMarkdown(td);
  }

  async convert(doc: string): Promise<string> {
    // Convert HTML string to markdown
    return this.turndownService.turndown(doc);
  }

  async convertXMLFile(xmlFile: XMLFile): Promise<string> {
    return this.convert(xmlFile.content);
  }
}
