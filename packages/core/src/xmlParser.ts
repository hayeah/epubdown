/* xmlParser.ts */

type DOMParserCtor = typeof window.DOMParser;
let DOMParser: DOMParserCtor;

// choose the implementation once
if (import.meta.env.SSR || typeof window === "undefined") {
  const { DOMParser: LinkeDOMParser } = await import("linkedom");
  DOMParser = LinkeDOMParser as DOMParserCtor;
} else {
  DOMParser = window.DOMParser;
}

export function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, "text/xml");
}

export function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

export function parseDocument(doc: string, mode: "html" | "xml"): Document {
  return mode === "html" ? parseHtml(doc) : parseXml(doc);
}
