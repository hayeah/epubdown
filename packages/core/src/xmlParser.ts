/* xmlParser.ts */

type DOMParserCtor = typeof window.DOMParser;
let HtmlDOMParser: DOMParserCtor;
let XmlDOMParser: DOMParserCtor;

// Use Vite's import.meta.SSR for conditional bundling
// @ts-ignore - import.meta.SSR is defined by Vite
if (import.meta.SSR ?? typeof window === "undefined") {
  // Server-side: Use jsdom for both HTML and XML parsing
  const { JSDOM } = await import("jsdom");

  // HTML parser using jsdom
  HtmlDOMParser = class {
    parseFromString(string: string, mimeType: string): Document {
      if (mimeType !== "text/html") {
        throw new Error(`Unsupported mime type for HTML parser: ${mimeType}`);
      }
      const dom = new JSDOM(string, {
        contentType: "text/html",
      });
      return dom.window.document;
    }
  } as any;

  // XML parser using jsdom
  XmlDOMParser = class {
    parseFromString(string: string, mimeType: string): Document {
      if (mimeType !== "text/xml" && mimeType !== "application/xml") {
        throw new Error(`Unsupported mime type for XML parser: ${mimeType}`);
      }
      try {
        const dom = new JSDOM(string, {
          contentType: "text/xml",
          xml: true, // This ensures XML parsing mode
        });
        return dom.window.document;
      } catch (error) {
        // Create a parsererror document similar to browser behavior
        const errorDom = new JSDOM(`<parsererror>${error}</parsererror>`, {
          contentType: "text/xml",
          xml: true,
        });
        return errorDom.window.document;
      }
    }
  } as any;
} else {
  // Client-side: Use native browser DOMParser
  HtmlDOMParser = window.DOMParser;
  XmlDOMParser = window.DOMParser;
}

export function parseXml(xml: string): Document {
  return new XmlDOMParser().parseFromString(xml, "text/xml");
}

export function parseHtml(html: string): Document {
  return new HtmlDOMParser().parseFromString(html, "text/html");
}

export function parseDocument(doc: string, mode: "html" | "xml"): Document {
  return mode === "html" ? parseHtml(doc) : parseXml(doc);
}
