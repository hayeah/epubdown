import { normalizePath, type EPub, type DOMFile } from "@epubdown/core";

// MIME type mapping for file extensions
const MIME_TYPES: Record<string, string> = {
  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  // Stylesheets
  css: "text/css",
  // Fonts
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
};

export class HtmlAssetInliner {
  // Blob URLs that need to be revoked to prevent memory leaks
  private readonly blobsToRevoke: string[] = [];
  private readonly doc: Document;

  constructor(
    private readonly epub: EPub,
    private readonly chapter: DOMFile,
  ) {
    // IMPORTANT: We work with the original HTML string instead of using DOM innerHTML
    // to preserve HTML entities like &nbsp;
    //
    // Why not use innerHTML?
    // When the browser parses HTML into DOM, entities like &nbsp; become Unicode
    // characters (U+00A0). When serializing back via innerHTML, these may be output
    // as raw Unicode characters rather than entities. While the characters are preserved
    // in the DOM and render correctly, the serialized format changes.
    //
    // Example:
    // - Original: "Hello&nbsp;&nbsp;World"
    // - After DOM parsing: "Hello\u00A0\u00A0World" (preserved in DOM)
    // - innerHTML output: "Hello  World" (raw U+00A0 chars, not entities)
    //
    // This can cause issues when the HTML is later processed, as some systems might
    // normalize or lose these Unicode nbsp characters. By working with the original
    // string, we preserve the exact entity encoding from the source.

    // Use the DOM directly for querying - no need to clone since we only read from it
    this.doc = chapter.dom;
  }

  async process(): Promise<{ html: string; cleanup: () => void }> {
    let html = this.chapter.content;

    // Pipeline transformations
    html = await this.inlineStylesheets(html);
    html = await this.inlineImages(html);
    html = await this.inlineSvgImages(html);
    html = this.extractBodyContent(html);

    // Create cleanup function that revokes all blob URLs
    // IMPORTANT: This cleanup function MUST be called when the HTML is no longer needed
    // to prevent memory leaks from unreleased blob URLs
    const cleanup = () => {
      for (const url of this.blobsToRevoke) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }
    };

    return { html, cleanup };
  }

  private async inlineStylesheets(html: string): Promise<string> {
    // Collect stylesheet replacements
    const styleReplacements: Array<{ pattern: RegExp; replacement: string }> =
      [];

    // Find and process <link rel="stylesheet">
    const links = Array.from(
      this.doc.querySelectorAll('link[rel="stylesheet"][href]'),
    );

    for (const link of links) {
      const href = link.getAttribute("href");
      if (!href) continue;

      const abs = normalizePath(this.chapter.base, href);
      const css = (await this.epub.resolver.read(abs)) ?? "";

      const processedCss = await this.rewriteCssUrls(css, abs);

      // Create a pattern to match this specific link tag
      const linkHtml = link.outerHTML;
      const pattern = new RegExp(
        linkHtml.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "gi",
      );
      const replacement = `<style data-inlined="${abs}">${processedCss}</style>`;
      styleReplacements.push({ pattern, replacement });
    }

    // Apply stylesheet replacements
    let result = html;
    for (const { pattern, replacement } of styleReplacements) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  private async inlineImages(html: string): Promise<string> {
    // Collect image replacements
    const imgReplacements: Array<{ pattern: RegExp; replacement: string }> = [];

    // Process <img src>
    for (const img of Array.from(this.doc.querySelectorAll("img[src]"))) {
      const src = img.getAttribute("src");
      if (!src || /^(https?:|data:|blob:)/i.test(src)) continue;

      const abs = normalizePath(this.chapter.base, src);
      const blobUrl = await this.toBlobUrl(abs);

      // Create pattern to replace src attribute
      const pattern = new RegExp(
        `(<img[^>]*\\ssrc=["'])${src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(["'][^>]*>)`,
        "gi",
      );
      const replacement = `$1${blobUrl}$2`;
      imgReplacements.push({ pattern, replacement });
    }

    // Apply image replacements
    let result = html;
    for (const { pattern, replacement } of imgReplacements) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  private async inlineSvgImages(html: string): Promise<string> {
    // Process SVG <image> elements
    const svgImageReplacements: Array<{
      pattern: RegExp;
      replacement: string;
    }> = [];

    for (const image of Array.from(this.doc.querySelectorAll("image"))) {
      const href =
        image.getAttribute("xlink:href") || image.getAttribute("href");
      if (!href || /^(https?:|data:|blob:)/i.test(href)) continue;

      const abs = normalizePath(this.chapter.base, href);
      const blobUrl = await this.toBlobUrl(abs);

      // Replace both xlink:href and href
      const xlinkPattern = new RegExp(
        `(<image[^>]*\\sxlink:href=["'])${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(["'])`,
        "gi",
      );
      const hrefPattern = new RegExp(
        `(<image[^>]*\\shref=["'])${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(["'])`,
        "gi",
      );

      svgImageReplacements.push(
        { pattern: xlinkPattern, replacement: `$1${blobUrl}$2` },
        { pattern: hrefPattern, replacement: `$1${blobUrl}$2` },
      );
    }

    // Apply SVG image replacements
    let result = html;
    for (const { pattern, replacement } of svgImageReplacements) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  private extractBodyContent(html: string): string {
    // Extract body content if present, otherwise use the whole document
    if (this.doc.body) {
      // Find body tag in original HTML
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch?.[1]) {
        // Get the body content
        return bodyMatch[1];
      }
    }
    return html;
  }

  private async toBlobUrl(abs: string): Promise<string> {
    const bytes = await this.epub.resolver.readRaw(abs);
    if (!bytes) return abs; // fallback

    const ext = abs.split(".").pop()?.toLowerCase();
    const mimeType = (ext && MIME_TYPES[ext]) || "application/octet-stream";

    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    this.blobsToRevoke.push(url);
    return url;
  }

  private async rewriteCssUrls(css: string, cssPath: string): Promise<string> {
    // Handle url() calls in CSS
    const urlRE = /url\(([^)]+)\)/g;
    const parts: string[] = [];
    let last = 0;
    let match: RegExpExecArray | null;

    // biome-ignore lint/suspicious/noAssignInExpressions: exec pattern is standard
    while ((match = urlRE.exec(css))) {
      const index = match.index ?? 0;
      parts.push(css.slice(last, index));
      const raw = (match[1] || "").trim().replace(/^['"]|['"]$/g, "");
      const mapped = raw.match(/^(https?:|data:|blob:)/i)
        ? raw
        : await this.toBlobUrl(
            normalizePath(cssPath.replace(/[^/]+$/, ""), raw),
          );
      parts.push(`url("${mapped}")`);
      last = index + match[0].length;
    }
    parts.push(css.slice(last));
    return parts.join("");
  }
}

// Export the legacy function for backward compatibility
export async function inlineChapterHTML(epub: EPub, chapter: DOMFile) {
  const inliner = new HtmlAssetInliner(epub, chapter);
  return inliner.process();
}
