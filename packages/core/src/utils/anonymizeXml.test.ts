import { describe, expect, it } from "vitest";
import { anonymizeXml } from "./anonymizeXml";

describe("anonymizeXml", () => {
  it("should replace text nodes with public domain text", async () => {
    const xml = "<root>Hello World</root>";
    const result = await anonymizeXml(xml);
    // "Hello World" is 11 chars, default limit is 15, so we get 11 chars
    expect(result).toBe("<root>Call me Ish</root>");
  });

  it("should default to XML mode when mode is not specified", async () => {
    const xml = `<root>
  <item>Test</item>
</root>`;
    const result = await anonymizeXml(xml);
    // In XML mode, whitespace should be preserved
    expect(result).toContain("<item>Call</item>");
    // Whitespace text nodes should not be replaced
    expect(result).toMatch(/<root>\s*<item>/);
  });

  it("should handle nested elements", async () => {
    const xml = "<root><p>Hello</p><p>World</p></root>";
    const result = await anonymizeXml(xml);
    expect(result).toBe("<root><p>Call </p><p>me Is</p></root>");
  });

  it("should limit text to 15 characters by default", async () => {
    const xml =
      "<root>This is a very long text that should be truncated</root>";
    const result = await anonymizeXml(xml);
    expect(result).toBe("<root>Call me Ishmael</root>");
  });

  it("should preserve original length when preserveLength is true", async () => {
    const xml = "<root>Hello</root>";
    const result = await anonymizeXml(xml, { preserveLength: true });
    expect(result).toBe("<root>Call </root>");
  });

  it("should handle long text with preserveLength", async () => {
    const xml =
      "<root>This is a very long text that should not be truncated when preserveLength is true</root>";
    const result = await anonymizeXml(xml, { preserveLength: true });
    // The original text is 81 characters long
    const match = result.match(/<root>(.*)<\/root>/);
    expect(match).toBeTruthy();
    expect(match?.[1]?.length).toBe(81);
  });

  it("should handle empty text nodes", async () => {
    const xml = "<root></root>";
    const result = await anonymizeXml(xml);
    expect(result).toBe("<root></root>");
  });

  it("should handle multiple text nodes sequentially", async () => {
    const xml = "<root>First<span>Second</span>Third</root>";
    const result = await anonymizeXml(xml);
    // "First" (5 chars) -> "Call " (5 chars)
    // "Second" (6 chars) -> "me Ish" (6 chars)
    // "Third" (5 chars) -> "mael." (5 chars)
    expect(result).toBe("<root>Call <span>me Ish</span>mael.</root>");
  });

  it("should wrap around corpus when text is longer than corpus", async () => {
    const longText = "x".repeat(1000);
    const xml = `<root>${longText}</root>`;
    const result = await anonymizeXml(xml, { preserveLength: true });
    expect(result).toMatch(/<root>.{1000}<\/root>/);
    // Should contain repeated portions of the corpus
    expect(result).toContain("Call me Ishmael");
  });

  it("should handle complex nested structure", async () => {
    const xml = `
      <article>
        <title>My Title</title>
        <section>
          <p>First paragraph</p>
          <p>Second paragraph with <em>emphasis</em> text</p>
        </section>
      </article>
    `
      .trim()
      .replace(/\s+/g, ">");

    const result = await anonymizeXml(xml);
    // Structure should be preserved
    expect(result).toContain("<article>");
    expect(result).toContain("<title>");
    expect(result).toContain("<section>");
    expect(result).toContain("<p>");
    expect(result).toContain("<em>");
    // Text should be replaced
    expect(result).not.toContain("My Title");
    expect(result).not.toContain("First paragraph");
  });

  it("should continue from where it left off for subsequent text nodes", async () => {
    const xml = "<root><a>12345</a><b>67890</b></root>";
    const result = await anonymizeXml(xml);
    // First node gets "Call " (5 chars)
    // Second node continues from "me Is" (5 chars)
    expect(result).toBe("<root><a>Call </a><b>me Is</b></root>");
  });

  it("should handle XHTML with namespaces in XML mode (skip whitespace)", async () => {
    const xml = `<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Star Maker</title>
  <link href="../Styles/stylesheet.css" rel="stylesheet" type="text/css" />
</head>
</html>`;
    const result = await anonymizeXml(xml, { mode: "xml" });

    // Should only replace the "Star Maker" text node (10 chars)
    expect(result).toContain("<title>Call me Is</title>");

    // Should NOT add text between <html> and <head>
    expect(result).not.toMatch(/<html[^>]*>[^<\s]+<head/);

    // Should NOT add text between </head> and </html>
    expect(result).not.toMatch(/<\/head>[^<\s]+<\/html>/);

    // Should preserve the link tag
    expect(result).toContain(
      '<link href="../Styles/stylesheet.css" rel="stylesheet" type="text/css" />',
    );
  });

  it("should handle HTML mode (skip whitespace-only text nodes)", async () => {
    const html = `<div>
  <p>Hello</p>
  <p>World</p>
</div>`;
    const result = await anonymizeXml(html, { mode: "html" });

    // In HTML mode, whitespace-only nodes are now skipped
    // Only "Hello" (5 chars) and "World" (5 chars) are replaced
    expect(result).toContain("<p>Call </p>");
    expect(result).toContain("<p>me Is</p>");

    // Whitespace between elements should be preserved but not replaced
    expect(result).toMatch(/<div>\s*<p>/);
  });

  it("should format output with prettier when format option is true", async () => {
    const xml = "<root><item>Test</item><item>Another</item></root>";
    const result = await anonymizeXml(xml, { mode: "xml", format: true });

    // Should be properly formatted with newlines and indentation
    expect(result).toContain("\n");
    expect(result).toMatch(/<root>\s*<item>/);

    // Should still anonymize the content
    expect(result).not.toContain("Test");
    expect(result).not.toContain("Another");
  });

  it("should handle full HTML documents with DOCTYPE", async () => {
    const html = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Test Title</title>
</head>
<body>
  <h1>Heading</h1>
  <p>Paragraph text</p>
</body>
</html>`;
    const result = await anonymizeXml(html, { mode: "html" });

    // Should anonymize all text content
    expect(result).not.toContain("Test Title");
    expect(result).not.toContain("Heading");
    expect(result).not.toContain("Paragraph text");

    // Should preserve structure
    expect(result).toContain("<html");
    expect(result).toContain("<head");
    expect(result).toContain("<body");
    expect(result).toContain("<h1>");
    expect(result).toContain("<p>");

    // Should now preserve DOCTYPE in output
    expect(result).toContain("<!DOCTYPE");
  });

  it("should preserve XML declaration and DOCTYPE in XML mode", async () => {
    const xml = `<?xml version="1.0" encoding="utf-8" standalone="no"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN"
  "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Test Title</title>
</head>
<body>
  <p>Test paragraph</p>
</body>
</html>`;
    const result = await anonymizeXml(xml, { mode: "xml" });

    // Should preserve XML declaration
    expect(result).toContain(
      '<?xml version="1.0" encoding="utf-8" standalone="no"?>',
    );

    // Should preserve DOCTYPE declaration (including multiline)
    expect(result).toContain(
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN"',
    );
    expect(result).toContain('"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">');

    // Should anonymize text content
    expect(result).not.toContain("Test Title");
    expect(result).not.toContain("Test paragraph");
  });

  it("should not create text nodes outside of body/html tags", async () => {
    const html = `<!DOCTYPE html>
<html>
<body>
  <p class="calibre35"><span class="calibre18">Original text here</span></p>
  <p class="calibre35"><span class="calibre18">More text here</span></p>
  <p class="calibre35"><span class="calibre18">And even more text</span></p>
</body>
</html>`;
    const result = await anonymizeXml(html, { mode: "html", format: true });

    // Should not have text outside of proper tags
    expect(result).not.toMatch(/>\s*[A-Za-z]+\s*</); // No text between > and <
    expect(result).not.toMatch(/<\/body>\s*[A-Za-z]/); // No text after </body>
    expect(result).not.toMatch(/<\/html>\s*[A-Za-z]/); // No text after </html>

    // Should have text only inside proper elements
    const lines = result.split("\n");
    for (const line of lines) {
      // Skip empty lines
      if (line.trim() === "") continue;
      // Each line should either be just tags or tags with text inside them
      if (!line.match(/^\s*<[^>]+>\s*$/)) {
        // Not just a tag
        expect(line).toMatch(/^\s*<[^>]+>.*<\/[^>]+>\s*$/); // Should be complete tag with content
      }
    }
  });

  it("should handle XHTML with HTML entities in HTML mode", async () => {
    const xhtml = `<?xml version="1.0" encoding="utf-8" standalone="no"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN"
  "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<body>
  <p>Text with &nbsp; entity</p>
</body>
</html>`;
    const result = await anonymizeXml(xhtml, { mode: "html" });

    // Should handle HTML entities correctly in HTML mode (no parsererror)
    expect(result).not.toContain("parsererror");
    // Should have anonymized the text content
    expect(result).toContain("Call me Ishmael");
    expect(result).not.toContain("Text with");
  });

  it("should create parsererror when HTML entities are used in XML mode", async () => {
    const xml = "<root>Text with &nbsp; entity</root>";
    const result = await anonymizeXml(xml, { mode: "xml" });

    // Should create parsererror document
    expect(result).toContain("<parsererror>");
    expect(result).toContain("Call me Ishmael");
  });

  it("should strip images when stripImages option is true", async () => {
    const { XmlAnonymizer } = await import("./anonymizeXml");
    const html = `<html>
<body>
  <p>Before image</p>
  <img src="test.jpg" alt="Test"/>
  <p>After image</p>
</body>
</html>`;

    const anonymizer = new XmlAnonymizer({ mode: "html", stripImages: true });
    const result = await anonymizer.anonymize(html);

    // Should replace img with text node
    expect(result).not.toContain("<img");
    expect(result).toContain("[image src: test.jpg]");

    // Should track stripped image paths
    const strippedPaths = anonymizer.getStrippedImagePaths();
    expect(strippedPaths.has("test.jpg")).toBe(true);
  });

  it("should not anonymize image replacement markers", async () => {
    const html = `<html>
<body>
  <p>[image src: already-stripped.jpg]</p>
  <p>Normal text</p>
</body>
</html>`;

    const result = await anonymizeXml(html, { mode: "html" });

    // Should preserve image markers as-is
    expect(result).toContain("[image src: already-stripped.jpg]");
    // Should anonymize normal text
    expect(result).not.toContain("Normal text");
    expect(result).toContain("Call me Ish");
  });
});
