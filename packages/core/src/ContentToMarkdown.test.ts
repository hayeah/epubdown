import { describe, expect, it } from "vitest";
import { ContentToMarkdown } from "./ContentToMarkdown";
import { DOMFile } from "./DOMFile";
import { parseDocument } from "./xmlParser";

function createMockXMLFile(html: string): DOMFile {
  // Detect if this is XHTML based on namespace declaration
  const contentType = html.includes('xmlns="http://www.w3.org/1999/xhtml"')
    ? "xhtml"
    : "html";
  const dom = parseDocument(html, contentType);
  return new DOMFile("/", "test.xhtml", html, dom, contentType);
}

describe("ContentToMarkdown", () => {
  it("converts basic HTML to markdown", async () => {
    const html = `
      <html>
        <body>
          <h1>Title</h1>
          <p>This is a paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
        </body>
      </html>
    `;
    const xmlFile = createMockXMLFile(html);
    const converter = ContentToMarkdown.create();
    const result = await converter.convertXMLFile(xmlFile);

    expect(result).toContain("# Title");
    expect(result).toContain(
      "This is a paragraph with **bold** and *italic* text.",
    );
  });

  it("removes EPUB metadata elements", async () => {
    const html = `
      <html>
        <head>
          <title>Book Title</title>
          <meta name="author" content="Author Name" />
          <link rel="stylesheet" href="style.css" />
        </head>
        <body>
          <p>Content</p>
        </body>
      </html>
    `;
    const xmlFile = createMockXMLFile(html);
    const converter = ContentToMarkdown.create();
    const result = await converter.convertXMLFile(xmlFile);

    expect(result).not.toContain("Book Title");
    expect(result).not.toContain("Author Name");
    expect(result).not.toContain("style.css");
    expect(result.trim()).toBe("Content");
  });

  it.skip("preserves IDs when keepIds option is provided", async () => {
    const html = `
      <html>
        <body>
          <h1 id="chapter1">Chapter 1</h1>
          <p id="para1">Paragraph with ID</p>
          <p id="para2">Another paragraph</p>
        </body>
      </html>
    `;
    const xmlFile = createMockXMLFile(html);
    const keepIds = new Set(["chapter1", "para1"]);
    const converter = ContentToMarkdown.create({ keepIds });
    const result = await converter.convertXMLFile(xmlFile);

    expect(result).toContain('<span id="chapter1"></span># Chapter 1');
    expect(result).toContain('<span id="para1"></span>Paragraph with ID');
    expect(result).not.toContain('<span id="para2"></span>');
  });

  it("extracts content from various container elements", async () => {
    const html = `
      <html>
        <main>
          <h1>Main Content</h1>
          <p>This is the main area</p>
        </main>
      </html>
    `;
    const xmlFile = createMockXMLFile(html);
    const converter = ContentToMarkdown.create();
    const result = await converter.convertXMLFile(xmlFile);

    expect(result).toContain("# Main Content");
    expect(result).toContain("This is the main area");
  });

  it("cleans up excessive whitespace", async () => {
    const html = `
      <html>
        <body>
          <p>First paragraph</p>
          
          
          
          <p>Second paragraph</p>
        </body>
      </html>
    `;
    const xmlFile = createMockXMLFile(html);
    const converter = ContentToMarkdown.create();
    const result = await converter.convertXMLFile(xmlFile);

    expect(result).toBe("First paragraph\n\nSecond paragraph");
  });

  it("handles nested structures", async () => {
    const html = `
      <html>
        <body>
          <article>
            <header>
              <h1>Article Title</h1>
            </header>
            <section>
              <h2>Section 1</h2>
              <p>Content of section 1</p>
            </section>
            <section>
              <h2>Section 2</h2>
              <p>Content of section 2</p>
            </section>
          </article>
        </body>
      </html>
    `;
    const xmlFile = createMockXMLFile(html);
    const converter = ContentToMarkdown.create();
    const result = await converter.convertXMLFile(xmlFile);

    expect(result).toContain("# Article Title");
    expect(result).toContain("## Section 1");
    expect(result).toContain("Content of section 1");
    expect(result).toContain("## Section 2");
    expect(result).toContain("Content of section 2");
  });

  it("converts HTML string directly with convertXMLFile method", async () => {
    const html = `
      <div>
        <h1>Direct HTML Conversion</h1>
        <p>This is a <strong>test</strong> of the convert method.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      </div>
    `;
    const xmlFile = createMockXMLFile(html);
    const converter = ContentToMarkdown.create();
    const result = await converter.convertXMLFile(xmlFile);

    expect(result).toContain("# Direct HTML Conversion");
    expect(result).toContain("This is a **test** of the convert method.");
    expect(result).toContain("Item 1");
    expect(result).toContain("Item 2");
  });

  it("converts img tags to markdown images", async () => {
    const html = `
      <html>
        <body>
          <p>Text before image</p>
          <img src="images/photo.jpg" alt="A photo" />
          <p>Text after image</p>
          <img src="images/9780262538459.jpg" alt="" />
          <img src="images/no-alt.png" />
        </body>
      </html>
    `;
    const xmlFile = createMockXMLFile(html);
    const converter = ContentToMarkdown.create();
    const result = await converter.convertXMLFile(xmlFile);

    // Base path defaults to '/', so relative paths normalize to absolute
    expect(result).toContain("Text before image");
    expect(result).toContain("![A photo](/images/photo.jpg)");
    expect(result).toContain("Text after image");
    // Empty alt should be preserved as empty
    expect(result).toContain("![](/images/9780262538459.jpg)");
    // Missing alt is set to filename
    expect(result).toContain("![no-alt.png](/images/no-alt.png)");
  });

  it("converts SVG image elements to markdown images", async () => {
    const html = `
      <html xmlns="http://www.w3.org/1999/xhtml" xmlns:svg="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <body>
          <div>
            <svg:svg viewBox="0 0 700 1064">
              <svg:image height="1064" transform="translate(0 0)" width="700" xlink:href="../images/9780192806840.jpg"></svg:image>
            </svg:svg>
          </div>
          <p>Some text</p>
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <image href="images/cover.png" width="100" height="100"></image>
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg">
            <image xlink:href="images/another.jpg"></image>
          </svg>
        </body>
      </html>
    `;
    const xmlFile = createMockXMLFile(html);
    const converter = ContentToMarkdown.create();
    const result = await converter.convertXMLFile(xmlFile);

    // Should convert SVG image elements to img with special alt; markdown conversion applies
    expect(result).toContain(
      "![_[SVG cover image not supported]_](/images/9780192806840.jpg)",
    );
    expect(result).toContain(
      "![_[SVG cover image not supported]_](/images/cover.png)",
    );
    expect(result).toContain(
      "![_[SVG cover image not supported]_](/images/another.jpg)",
    );
    expect(result).toContain("Some text");
  });

  describe("Self-closing tag fix", () => {
    // Note: EPUB XHTML files often contain self-closing non-void tags like <title/> which are valid in XML
    // but problematic when parsed as HTML. The original issue was that TurndownService would re-parse
    // the XML content as HTML, causing content to disappear in browsers.
    //
    // This has been fixed by using a custom branch of turndown (github:mixmark-io/turndown#hayeah-external-dom)
    // that supports passing DOM elements directly, avoiding the double-parsing issue.
    // We now pass the body element from XMLFile.dom directly to TurndownService instead of the string content.

    it("should handle content with self-closing non-void tags", async () => {
      // This is the problematic pattern from the EPUB
      const html = `<html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <title/>
          <link href="css/test.css" rel="stylesheet" type="text/css"/>
        </head>
        <body><a id="p9"/>
          <h1>Why Study Cycles?</h1>
          <p>Important content here</p>
        </body>
      </html>`;

      const xmlFile = createMockXMLFile(html);
      const converter = ContentToMarkdown.create();
      const result = await converter.convertXMLFile(xmlFile);

      // The fix should preserve the content
      expect(result).toContain("Why Study Cycles");
      expect(result).toContain("Important content");
      expect(result.length).toBeGreaterThan(0);

      // Should convert to markdown heading
      expect(result).toMatch(/^#+ Why Study Cycles\?$/m);
    });

    it("should not modify void elements", async () => {
      const html = `<body>
        <h1>Title</h1>
        <br/>
        <hr/>
        <img src="test.jpg"/>
        <p>Content</p>
      </body>`;

      const xmlFile = createMockXMLFile(html);
      const converter = ContentToMarkdown.create();
      const result = await converter.convertXMLFile(xmlFile);

      expect(result).toContain("Title");
      expect(result).toContain("* * *"); // hr converts to * * *
      expect(result).toContain("![test.jpg](/test.jpg)"); // img converts to markdown image with filename alt
      expect(result).toContain("Content");
    });

    it("should handle mixed self-closing tags", async () => {
      // Test with XHTML content (typical in EPUBs)
      const html = `<html xmlns="http://www.w3.org/1999/xhtml">
        <body>
          <custom-tag/>
          <title/>
          <a id="test"/>
          <h1>Content After Self-Closing Tags</h1>
          <br/>
          <p>More content</p>
        </body>
      </html>`;

      const xmlFile = createMockXMLFile(html);
      const converter = ContentToMarkdown.create();
      const result = await converter.convertXMLFile(xmlFile);

      // Content should be preserved despite self-closing tags
      expect(result).toContain("Content After Self-Closing Tags");
      expect(result).toContain("More content");
    });
  });
});
