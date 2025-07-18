import { describe, expect, it } from "vitest";
import { ContentToMarkdown } from "./ContentToMarkdown";
import { FileDataResolver, XMLFile } from "./Epub";
import { parseXml } from "./xmlParser";

function createMockXMLFile(html: string): XMLFile {
  const dom = parseXml(html) as XMLDocument;
  const resolver = new FileDataResolver("");
  return new XMLFile("", "test.xhtml", html, dom, resolver);
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
    expect(result).toBe("Content");
  });

  it("removes page-list navigation", async () => {
    const html = `
      <html>
        <body>
          <nav epub:type="page-list">
            <ol>
              <li><a href="#page1">Page 1</a></li>
              <li><a href="#page2">Page 2</a></li>
            </ol>
          </nav>
          <p>Main content</p>
        </body>
      </html>
    `;
    const xmlFile = createMockXMLFile(html);
    const converter = ContentToMarkdown.create();
    const result = await converter.convertXMLFile(xmlFile);

    expect(result).not.toContain("Page 1");
    expect(result).not.toContain("Page 2");
    expect(result).toBe("Main content");
  });

  it("cleans up calibre and epub structural elements", async () => {
    const html = `
      <html>
        <body>
          <div class="calibre1">
            <p>Content</p>
          </div>
          <span class="epub-type">More content</span>
          <div epub:type="pagebreak"></div>
        </body>
      </html>
    `;
    const xmlFile = createMockXMLFile(html);
    const converter = ContentToMarkdown.create();
    const result = await converter.convertXMLFile(xmlFile);

    expect(result).toBe("Content\n\nMore content");
  });

  it("preserves paragraph structure", async () => {
    const html = `
      <html>
        <body>
          <p class="calibre-paragraph">First paragraph</p>
          <p class="epub-style">Second paragraph</p>
        </body>
      </html>
    `;
    const xmlFile = createMockXMLFile(html);
    const converter = ContentToMarkdown.create();
    const result = await converter.convertXMLFile(xmlFile);

    expect(result).toBe("First paragraph\n\nSecond paragraph");
  });

  it("preserves IDs when keepIds option is provided", async () => {
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

  it("converts HTML string directly with convert method", async () => {
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
    const converter = ContentToMarkdown.create();
    const result = await converter.convert(html);

    expect(result).toContain("# Direct HTML Conversion");
    expect(result).toContain("This is a **test** of the convert method.");
    expect(result).toContain("Item 1");
    expect(result).toContain("Item 2");
  });
});
