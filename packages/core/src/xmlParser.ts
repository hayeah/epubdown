/* xmlParser.ts */

type DOMParserCtor = typeof window.DOMParser;
let DOMParser: DOMParserCtor;

// Use Vite's import.meta.SSR for conditional bundling
// @ts-ignore - import.meta.SSR is defined by Vite
if (import.meta.SSR ?? typeof window === "undefined") {
  // Server-side: Use jsdom for both HTML and XML parsing
  const { JSDOM } = await import("jsdom");

  DOMParser = class {
    parseFromString(string: string, mimeType: string): Document {
      if (mimeType === "text/html") {
        const dom = new JSDOM(string, {
          contentType: "text/html",
        });
        return dom.window.document;
      }
      if (mimeType === "text/xml" || mimeType === "application/xml") {
        try {
          const dom = new JSDOM(string, {
            contentType: mimeType,
          });
          return dom.window.document;
        } catch (error) {
          // Create a parsererror document similar to browser behavior
          const errorDom = new JSDOM(`<parsererror>${error}</parsererror>`, {
            contentType: "text/xml",
          });
          return errorDom.window.document;
        }
      }
      throw new Error(`Unsupported mime type: ${mimeType}`);
    }
  } as any;
} else {
  // Client-side: Use native browser DOMParser
  DOMParser = window.DOMParser;
}

export { DOMParser };

export function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, "text/xml");
}

export function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

export function parseDocument(doc: string, mode: "html" | "xml"): Document {
  return mode === "html" ? parseHtml(doc) : parseXml(doc);
}
