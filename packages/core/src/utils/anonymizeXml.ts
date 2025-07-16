import pluginXml from "@prettier/plugin-xml";
import prettier from "prettier";
import { parseHtml, parseXml } from "../xmlParser";

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
  private corpusIdx = 0;
  private corpusLen = PUBLIC_DOMAIN_TEXT.length;
  private xmlDeclaration: string | null = null;
  private doctype: string | null = null;

  constructor(
    opts: {
      preserveLength?: boolean;
      mode?: "xml" | "html";
      format?: boolean;
    } = {},
  ) {
    this.preserveLength = opts.preserveLength ?? false;
    this.mode = opts.mode ?? "xml";
    this.format = opts.format ?? false;
  }

  async anonymize(xml: string): Promise<string> {
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

    const doc = this.parseDocument(xml);
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

  private parseDocument(xml: string): Document {
    return this.mode === "html" ? parseHtml(xml) : parseXml(xml);
  }

  private traverseAndAnonymize(node: Node): void {
    if (node.nodeType === 3) {
      // TEXT_NODE = 3
      const original = node.nodeValue || "";
      if (original.trim() === "") return;

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
      return doc.toString();
    } else if (typeof XMLSerializer !== "undefined") {
      return new XMLSerializer().serializeToString(doc);
    } else {
      return doc.documentElement?.outerHTML || "";
    }
  }

  private cleanOutput(serialized: string): string {
    // Just trim the end, preserve XML declaration and DOCTYPE
    return serialized.trimEnd();
  }

  private convertSelfClosingTags(str: string): string {
    return str.replace(/<(\w+)\s*\/>/g, "<$1></$1>");
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
  opts: {
    preserveLength?: boolean;
    mode?: "xml" | "html";
    format?: boolean;
  } = {},
): Promise<string> {
  const anonymizer = new XmlAnonymizer(opts);
  return anonymizer.anonymize(xml);
}
