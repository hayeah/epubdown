import { join } from "node:path";
import pluginXml from "@prettier/plugin-xml";
import prettier from "prettier";
import { parseDocument } from "../xmlParser";

export interface XmlAnonymizerOptions {
  preserveLength?: boolean;
  mode?: "xml" | "html";
  format?: boolean;
  stripImages?: boolean;
  basePath?: string;
}

const PUBLIC_DOMAIN_TEXT = `
Call me Ishmael. Some years ago—never mind how long precisely—having little or no money
in my purse, and nothing particular to interest me on shore, I thought I would sail about
a little and see the watery part of the world. It is a way I have of driving off the spleen
and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever
it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before
coffin warehouses, and bringing up the rear of every funeral I meet; and especially whenever
my hypos get such an upper hand of me, that it requires a strong moral principle to prevent
me from deliberately stepping into the street, and methodically knocking people's hats off—
then, I account it high time to get to sea as soon as I can.
`
  .trim()
  .replace(/\s+/g, " ");

export class XmlAnonymizer {
  private preserveLength: boolean;
  private mode: "xml" | "html";
  private format: boolean;
  private stripImages: boolean;
  private basePath?: string;
  private corpusIdx = 0;
  private corpusLen = PUBLIC_DOMAIN_TEXT.length;
  private xmlDeclaration: string | null = null;
  private doctype: string | null = null;
  private strippedImagePaths = new Set<string>();

  constructor(opts: XmlAnonymizerOptions = {}) {
    this.preserveLength = opts.preserveLength ?? false;
    this.mode = opts.mode ?? "xml";
    this.format = opts.format ?? false;
    this.stripImages = opts.stripImages ?? false;
    this.basePath = opts.basePath;
  }

  async anonymize(xml: string): Promise<string> {
    // Reset stripped image paths for this document
    this.strippedImagePaths.clear();

    // Extract XML declaration if present
    const xmlDeclMatch = xml.match(/^<\?xml[^?]*\?>\s*/);
    if (xmlDeclMatch) {
      this.xmlDeclaration = xmlDeclMatch[0];
    }

    // Extract DOCTYPE declaration if present (including multiline)
    const doctypeMatch = xml.match(/<!DOCTYPE[^>]*>(\s*\[[^\]]*\])?\s*/i);
    if (doctypeMatch) {
      this.doctype = doctypeMatch[0];
    }

    const doc = parseDocument(xml, this.mode);

    // Strip images first if requested
    if (this.stripImages) {
      this.stripImagesFromDocument(doc);
    }

    this.traverseAndAnonymize(doc.documentElement || doc);
    let result = this.serializeDocument(doc);
    result = this.cleanOutput(result);
    if (this.mode === "xml") {
      result = this.convertSelfClosingTags(result);
    }

    // Prepend declarations in the correct order
    if (this.doctype && this.mode === "xml") {
      result = this.doctype + result;
    }
    if (this.xmlDeclaration && this.mode === "xml") {
      result = this.xmlDeclaration + result;
    }

    if (this.format) {
      result = await this.formatOutput(result);
    }
    return result;
  }

  getStrippedImagePaths(): Set<string> {
    return this.strippedImagePaths;
  }

  private traverseAndAnonymize(node: Node): void {
    if (node.nodeType === 3) {
      // TEXT_NODE = 3
      const original = node.nodeValue || "";
      if (original.trim() === "") return;

      // Skip anonymizing image replacement markers
      if (original.match(/^\[image src: [^\]]+\]$/)) {
        return;
      }

      const desiredLength = this.preserveLength
        ? original.length
        : Math.min(original.length, 15);

      let replacement = "";
      let remaining = desiredLength;
      while (remaining > 0) {
        const sliceLen = Math.min(remaining, this.corpusLen - this.corpusIdx);
        replacement += PUBLIC_DOMAIN_TEXT.slice(
          this.corpusIdx,
          this.corpusIdx + sliceLen,
        );
        this.corpusIdx = (this.corpusIdx + sliceLen) % this.corpusLen;
        remaining -= sliceLen;
      }
      (node as CharacterData).data = replacement;
    } else {
      for (let child = node.firstChild; child; child = child.nextSibling) {
        this.traverseAndAnonymize(child);
      }
    }
  }

  private serializeDocument(doc: Document): string {
    if (this.mode === "html") {
      // For HTML, serialize the entire document including DOCTYPE
      const doctype = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>\n` : "";
      const html = doc.documentElement?.outerHTML || "";
      return doctype + html;
    }
    if (typeof XMLSerializer !== "undefined") {
      return new XMLSerializer().serializeToString(doc);
    }
    return doc.documentElement?.outerHTML || "";
  }

  private cleanOutput(serialized: string): string {
    // Just trim the end, preserve XML declaration and DOCTYPE
    return serialized.trimEnd();
  }

  private convertSelfClosingTags(str: string): string {
    return str.replace(/<(\w+)\s*\/>/g, "<$1></$1>");
  }

  private stripImagesFromDocument(doc: Document): void {
    // Find all img elements
    const images = doc.querySelectorAll("img");
    for (const img of images) {
      const src = img.getAttribute("src");
      if (src) {
        // Store just the src path, not the full path
        this.strippedImagePaths.add(src);
        const textNode = doc.createTextNode(`[image src: ${src}]`);
        img.parentNode?.replaceChild(textNode, img);
      }
    }

    // Also handle SVG image elements
    const svgImages = doc.querySelectorAll("image");
    for (const img of svgImages) {
      const href = img.getAttribute("xlink:href") || img.getAttribute("href");
      if (href) {
        // Store just the href path, not the full path
        this.strippedImagePaths.add(href);
        const textNode = doc.createTextNode(`[image src: ${href}]`);
        img.parentNode?.replaceChild(textNode, img);
      }
    }
  }

  getBasePath(): string | undefined {
    return this.basePath;
  }

  private async formatOutput(str: string): Promise<string> {
    try {
      const formatted = await prettier.format(str, {
        parser: this.mode === "html" ? "html" : "xml",
        plugins: this.mode === "html" ? [] : [pluginXml],
        printWidth: 120,
        tabWidth: 2,
        xmlWhitespaceSensitivity: "ignore",
        bracketSameLine: true,
        htmlWhitespaceSensitivity: "ignore",
        singleAttributePerLine: false,
      });
      return formatted.trimEnd();
    } catch {
      return str;
    }
  }
}

export async function anonymizeXml(
  xml: string,
  opts: XmlAnonymizerOptions = {},
): Promise<string> {
  const anonymizer = new XmlAnonymizer(opts);
  return anonymizer.anonymize(xml);
}
