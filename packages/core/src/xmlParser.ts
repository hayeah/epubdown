/* xmlParser.ts */

type DOMParserCtor = typeof window.DOMParser;
let DOMParser: DOMParserCtor;

// Use Vite's import.meta.SSR for conditional bundling
// @ts-ignore - import.meta.SSR is defined by Vite
if (import.meta.SSR ?? typeof window === "undefined") {
  // Server-side: Use jsdom for both HTML and XML parsing
  const { JSDOM } = await import("jsdom");

  /**
   * Cleans HTML/XML content to prevent CSS parsing errors in jsdom.
   *
   * The @page CSS rule is a valid CSS feature used for controlling page layout when
   * printing, but jsdom's CSS parser doesn't handle it well. This is a known limitation
   * of jsdom - it's primarily designed for testing web pages, not for handling
   * print-specific CSS features that are common in EPUB files.
   *
   * This function removes problematic style and script tags that can cause parsing errors.
   */
  function cleanContent(content: string): string {
    // Remove style tags to prevent CSS parsing errors in jsdom
    let cleanedContent = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    // Remove script tags for additional safety
    cleanedContent = cleanedContent.replace(
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      "",
    );
    return cleanedContent;
  }

  DOMParser = class {
    parseFromString(string: string, mimeType: string): Document {
      if (mimeType === "text/html") {
        const cleanedString = cleanContent(string);
        const dom = new JSDOM(cleanedString, {
          contentType: "text/html",
        });
        return dom.window.document;
      }
      if (
        mimeType === "text/xml" ||
        mimeType === "application/xml" ||
        mimeType === "application/xhtml+xml"
      ) {
        try {
          const cleanedString = cleanContent(string);
          const dom = new JSDOM(cleanedString, {
            contentType:
              mimeType === "application/xhtml+xml"
                ? "application/xml"
                : mimeType,
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
