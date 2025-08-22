/* xmlParser.ts */

type DOMParserCtor = typeof window.DOMParser;
let DOMParser: DOMParserCtor;

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
      if (
        mimeType === "text/xml" ||
        mimeType === "application/xml" ||
        mimeType === "application/xhtml+xml"
      ) {
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

/**
 * Parse a document string with the specified content type.
 *
 * XHTML Mode and Named Entities:
 * When parsing as application/xhtml+xml (XHTML), browsers treat it as strict XML.
 * This means only the 5 built-in XML entities are recognized (&lt;, &gt;, &amp;, &quot;, &apos;).
 * HTML named entities like &nbsp; are NOT recognized unless the XHTML DTD is loaded,
 * which browsers generally don't do for security/performance reasons.
 * As a result, &nbsp; and other HTML entities will cause parse errors in XHTML mode.
 *
 * To handle EPUB XHTML files that use HTML entities, we clean the content before parsing.
 */
export function parseDocument(str: string, contentType = "xml"): Document {
  // Handle shortcuts
  const mimeTypeMap: Record<string, string> = {
    html: "text/html",
    xhtml: "application/xhtml+xml", // Parse XHTML as XML to preserve structure
    xml: "text/xml",
  };

  // Use mapped MIME type if it's a shortcut, otherwise use as-is
  const mimeType = mimeTypeMap[contentType] || contentType;

  // Validate that we have a supported MIME type
  const supportedTypes = [
    "text/html",
    "text/xml",
    "application/xml",
    "application/xhtml+xml",
  ];

  if (!supportedTypes.includes(mimeType)) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  // Clean content to remove problematic elements
  let cleanedStr = cleanContent(str);

  // For XHTML, remove &nbsp; entities which cause parse errors
  if (mimeType === "application/xhtml+xml") {
    cleanedStr = cleanedStr.replace(/&nbsp;/g, " ");
  }

  return new DOMParser().parseFromString(
    cleanedStr,
    mimeType as DOMParserSupportedType,
  );
}
