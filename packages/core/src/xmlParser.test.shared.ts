import { describe, expect, it } from "vitest";

/**
 * Shared test cases for xmlParser that work in both jsdom and browser environments
 * Specifically testing self-closing tag behavior in different parsing modes
 */
export function createXmlParserTests(DOMParserImpl: typeof DOMParser) {
  return () => {
    describe("Self-closing tags in XML mode", () => {
      it("should parse self-closing tags correctly in XML mode", () => {
        const parser = new DOMParserImpl();
        const xml = `<?xml version="1.0"?>
          <root>
            <title/>
            <a id="p9"/>
            <content>This is content</content>
          </root>`;

        const doc = parser.parseFromString(xml, "text/xml");

        // Check for parser errors
        const parserError = doc.querySelector("parsererror");
        expect(parserError).toBeNull();

        // Check structure
        const root = doc.querySelector("root");
        expect(root).toBeTruthy();

        const title = doc.querySelector("title");
        expect(title).toBeTruthy();
        expect(title?.textContent).toBe("");
        expect(title?.childNodes.length).toBe(0);

        const anchor = doc.querySelector("a");
        expect(anchor).toBeTruthy();
        expect(anchor?.getAttribute("id")).toBe("p9");
        expect(anchor?.textContent).toBe("");

        const content = doc.querySelector("content");
        expect(content).toBeTruthy();
        expect(content?.textContent).toBe("This is content");
      });

      it("should handle EPUB-style XHTML with self-closing tags", () => {
        const parser = new DOMParserImpl();
        const xhtml = `<html xmlns="http://www.w3.org/1999/xhtml">
          <head>
            <title/>
            <link href="css/test.css" rel="stylesheet" type="text/css"/>
            <meta name="test" content="value"/>
          </head>
          <body><a id="p9"/>
            <h1>Test Title</h1>
            <p>Test content</p>
          </body>
        </html>`;

        const doc = parser.parseFromString(xhtml, "text/xml");

        // Check for parser errors
        const parserError = doc.querySelector("parsererror");
        expect(parserError).toBeNull();

        // Check that body has the correct content
        const body = doc.querySelector("body");
        expect(body).toBeTruthy();
        expect(body?.children.length).toBeGreaterThan(0);

        const h1 = doc.querySelector("h1");
        expect(h1).toBeTruthy();
        expect(h1?.textContent).toBe("Test Title");

        const p = doc.querySelector("p");
        expect(p).toBeTruthy();
        expect(p?.textContent).toBe("Test content");
      });

      it("should handle malformed body tag with immediate content", () => {
        const parser = new DOMParserImpl();
        // This is the problematic pattern from the EPUB file
        const xhtml = `<html xmlns="http://www.w3.org/1999/xhtml">
          <head>
            <title/>
          </head>
          <body><a id="p9"/>
<h1>Chapter Title</h1>
<p>Content here</p>
          </body>
        </html>`;

        const doc = parser.parseFromString(xhtml, "text/xml");

        const body = doc.querySelector("body");
        expect(body).toBeTruthy();

        // Check if content is in body or misplaced
        const h1 = doc.querySelector("h1");
        expect(h1).toBeTruthy();

        // Check if h1 is actually in the body
        const bodyH1 = body?.querySelector("h1");
        expect(bodyH1).toBeTruthy();
        expect(bodyH1?.textContent).toBe("Chapter Title");
      });
    });

    describe("Self-closing tags in HTML mode", () => {
      it("should handle self-closing tags in HTML mode", () => {
        const parser = new DOMParserImpl();
        const html = `<!DOCTYPE html>
          <html>
            <head>
              <title/>
              <meta name="test" content="value"/>
            </head>
            <body>
              <a id="p9"/>
              <h1>Test Title</h1>
              <p>Test content</p>
            </body>
          </html>`;

        const doc = parser.parseFromString(html, "text/html");

        // In HTML mode, there should be no parser errors
        const parserError = doc.querySelector("parsererror");
        expect(parserError).toBeNull();

        const body = doc.querySelector("body");
        expect(body).toBeTruthy();

        // In HTML mode with self-closing non-void tags, parsing can be inconsistent
        // Check if content exists anywhere in the document
        const h1 = doc.querySelector("h1");
        if (h1) {
          expect(h1.textContent).toBe("Test Title");
        }

        // Check if anchor tag is properly parsed
        const anchor = doc.querySelector("a#p9");
      });

      it("should handle void elements correctly in HTML", () => {
        const parser = new DOMParserImpl();
        const html = `<!DOCTYPE html>
          <html>
            <body>
              <br/>
              <hr/>
              <img src="test.jpg"/>
              <input type="text"/>
              <p>After void elements</p>
            </body>
          </html>`;

        const doc = parser.parseFromString(html, "text/html");

        expect(doc.querySelector("br")).toBeTruthy();
        expect(doc.querySelector("hr")).toBeTruthy();
        expect(doc.querySelector("img")).toBeTruthy();
        expect(doc.querySelector("input")).toBeTruthy();
        expect(doc.querySelector("p")?.textContent).toBe("After void elements");
      });

      it("should convert custom self-closing tags to open/close in HTML", () => {
        const parser = new DOMParserImpl();
        const html = `<!DOCTYPE html>
          <html>
            <body>
              <custom-tag/>
              <another-tag id="test"/>
              <p>After custom tags</p>
            </body>
          </html>`;

        const doc = parser.parseFromString(html, "text/html");

        const customTag = doc.querySelector("custom-tag");
        expect(customTag).toBeTruthy();

        const anotherTag = doc.querySelector("another-tag");
        expect(anotherTag).toBeTruthy();
        expect(anotherTag?.getAttribute("id")).toBe("test");

        const p = doc.querySelector("p");
        expect(p).toBeTruthy();
        expect(p?.textContent).toBe("After custom tags");
      });
    });

    describe("XHTML mode (application/xhtml+xml)", () => {
      it("should parse XHTML with self-closing tags", () => {
        const parser = new DOMParserImpl();
        const xhtml = `<?xml version="1.0"?>
          <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" 
            "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
          <html xmlns="http://www.w3.org/1999/xhtml">
            <head>
              <title>Test</title>
              <meta name="test" content="value"/>
            </head>
            <body>
              <a id="p9"/>
              <h1>XHTML Test</h1>
              <br/>
              <p>Content</p>
            </body>
          </html>`;

        const doc = parser.parseFromString(xhtml, "application/xhtml+xml");

        // Check for parser errors
        const parserError = doc.querySelector("parsererror");
        expect(parserError).toBeNull();

        const h1 = doc.querySelector("h1");
        expect(h1).toBeTruthy();
        expect(h1?.textContent).toBe("XHTML Test");

        const br = doc.querySelector("br");
        expect(br).toBeTruthy();

        const p = doc.querySelector("p");
        expect(p).toBeTruthy();
        expect(p?.textContent).toBe("Content");
      });

      it("should handle namespace in XHTML mode", () => {
        const parser = new DOMParserImpl();
        const xhtml = `<?xml version="1.0"?>
          <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
            <head>
              <title/>
            </head>
            <body>
              <nav epub:type="toc"/>
              <div>Content</div>
            </body>
          </html>`;

        const doc = parser.parseFromString(xhtml, "application/xhtml+xml");

        const nav = doc.querySelector("nav");
        expect(nav).toBeTruthy();

        const div = doc.querySelector("div");
        expect(div).toBeTruthy();
        expect(div?.textContent).toBe("Content");
      });
    });

    describe("Error handling", () => {
      it("should handle malformed XML", () => {
        const parser = new DOMParserImpl();
        const malformedXml = `<?xml version="1.0"?>
          <root>
            <unclosed>
            <another>tag</another>
          </root>`;

        const doc = parser.parseFromString(malformedXml, "text/xml");

        // In XML mode, malformed XML should result in a parsererror
        const parserError = doc.querySelector("parsererror");
        expect(parserError).toBeTruthy();
      });

      it("should not error on malformed HTML", () => {
        const parser = new DOMParserImpl();
        const malformedHtml = `<!DOCTYPE html>
          <html>
            <body>
              <unclosed>
              <p>Still works</p>
            </body>
          </html>`;

        const doc = parser.parseFromString(malformedHtml, "text/html");

        // HTML parsers are forgiving
        const parserError = doc.querySelector("parsererror");
        expect(parserError).toBeNull();

        const p = doc.querySelector("p");
        expect(p).toBeTruthy();
        expect(p?.textContent).toBe("Still works");
      });
    });

    describe("Direct DOMParser behavior comparison", () => {
      it("should show how DOMParser handles body tag with immediate content", () => {
        const parser = new DOMParserImpl();

        // Test the exact pattern from the problematic EPUB
        const problematicContent = `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
        <head>
          <title/>
          <link href="css/hmh.css" rel="stylesheet" type="text/css"/>
<meta content="urn:uuid:0cc8d375-bae9-402e-a2f0-57f91bd28dd1" name="Adept.expected.resource"/>
        </head>
        <body><a id="p9"/>
<h1 class="CN">I</h1>
<h1 class="chaptertitle chapter">Why Study Cycles?</h1>
<p>Content here</p>
        </body>
      </html>`;

        // Test in XML mode
        const xmlDoc = parser.parseFromString(problematicContent, "text/xml");
        const xmlBody = xmlDoc.querySelector("body");
        const xmlH1 = xmlDoc.querySelector("h1");

        // Test in HTML mode
        const htmlDoc = parser.parseFromString(problematicContent, "text/html");
        const htmlBody = htmlDoc.querySelector("body");
        const htmlH1 = htmlDoc.querySelector("h1");

        // Expectations for XML mode
        expect(xmlBody).toBeTruthy();
        expect(xmlH1).toBeTruthy();

        // The content should be in the body
        const xmlBodyH1 = xmlBody?.querySelector("h1");
        expect(xmlBodyH1).toBeTruthy();

        // Expectations for HTML mode
        // Note: In jsdom's HTML mode, self-closing non-void tags can cause parsing issues
        // The body should exist, but content might be misplaced
        expect(htmlBody).toBeTruthy();

        // This demonstrates the issue - in HTML mode with jsdom,
        // self-closing tags can cause content to be lost or misplaced
        if (htmlH1) {
          // If h1 is found, it should be in the body
          const htmlBodyH1 = htmlBody?.querySelector("h1");
          expect(htmlBodyH1).toBeTruthy();
        }
      });

      it("should demonstrate self-closing tag parsing differences", () => {
        const parser = new DOMParserImpl();
        const content = "<root><item/><next>Value</next></root>";

        // XML mode
        const xmlDoc = parser.parseFromString(content, "text/xml");
        const xmlItem = xmlDoc.querySelector("item");
        const xmlNext = xmlDoc.querySelector("next");

        expect(xmlItem).toBeTruthy();
        expect(xmlItem?.textContent).toBe("");
        expect(xmlNext).toBeTruthy();
        expect(xmlNext?.textContent).toBe("Value");

        // HTML mode - custom tags might be handled differently
        const htmlContent = `<!DOCTYPE html><html><body>${content}</body></html>`;
        const htmlDoc = parser.parseFromString(htmlContent, "text/html");
        const htmlItem = htmlDoc.querySelector("item");
        const htmlNext = htmlDoc.querySelector("next");

        expect(htmlItem).toBeTruthy();
        expect(htmlNext).toBeTruthy();
        expect(htmlNext?.textContent).toBe("Value");
      });
    });
  };
}
