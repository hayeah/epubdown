import { describe, expect, it } from "vitest";
import { querySelectorNamespaced } from "./querySelectorNamespaced";

/**
 * Shared test cases for querySelectorNamespaced that work in both jsdom and browser environments
 */
export function createQuerySelectorNamespacedTests(
  parseXml: (xml: string) => Document,
  parseHtml: (html: string) => Document,
) {
  return () => {
    describe("XML mode", () => {
      it("should find elements with namespaced attributes", () => {
        const xml = `<?xml version="1.0"?>
          <root xmlns:epub="http://www.idpf.org/2007/ops">
            <nav epub:type="toc">
              <h1>Table of Contents</h1>
            </nav>
            <nav epub:type="landmarks">
              <h1>Landmarks</h1>
            </nav>
          </root>`;

        const doc = parseXml(xml);
        const result = querySelectorNamespaced(
          doc,
          "nav",
          'type="toc"',
          "epub",
        );

        expect(result).toBeTruthy();
        expect(result?.querySelector("h1")?.textContent).toBe(
          "Table of Contents",
        );
      });

      it("should find elements with wildcard namespace selector", () => {
        const xml = `<?xml version="1.0"?>
          <root xmlns:custom="http://example.com">
            <nav custom:type="toc">
              <h1>Custom TOC</h1>
            </nav>
          </root>`;

        const doc = parseXml(xml);
        const result = querySelectorNamespaced(
          doc,
          "nav",
          'type="toc"',
          "custom",
        );

        expect(result).toBeTruthy();
        expect(result?.querySelector("h1")?.textContent).toBe("Custom TOC");
      });

      it("should fall back to non-namespaced selector", () => {
        const xml = `<?xml version="1.0"?>
          <root>
            <nav type="toc">
              <h1>Simple TOC</h1>
            </nav>
          </root>`;

        const doc = parseXml(xml);
        const result = querySelectorNamespaced(
          doc,
          "nav",
          'type="toc"',
          "epub",
        );

        expect(result).toBeTruthy();
        expect(result?.querySelector("h1")?.textContent).toBe("Simple TOC");
      });

      it("should return null when no match found", () => {
        const xml = `<?xml version="1.0"?>
          <root>
            <nav epub:type="landmarks">
              <h1>Not TOC</h1>
            </nav>
          </root>`;

        const doc = parseXml(xml);
        const result = querySelectorNamespaced(
          doc,
          "nav",
          'type="toc"',
          "epub",
        );

        expect(result).toBeNull();
      });

      it("should work with complex attribute values", () => {
        const xml = `<?xml version="1.0"?>
          <root xmlns:epub="http://www.idpf.org/2007/ops">
            <nav epub:type="toc page-list">
              <h1>Complex TOC</h1>
            </nav>
          </root>`;

        const doc = parseXml(xml);
        const result = querySelectorNamespaced(
          doc,
          "nav",
          'type="toc page-list"',
          "epub",
        );

        expect(result).toBeTruthy();
        expect(result?.querySelector("h1")?.textContent).toBe("Complex TOC");
      });
    });

    describe("HTML mode", () => {
      it("should work with escaped namespace in HTML", () => {
        const html = `<!DOCTYPE html>
          <html xmlns:epub="http://www.idpf.org/2007/ops">
            <body>
              <nav epub:type="toc">
                <h1>HTML TOC</h1>
              </nav>
            </body>
          </html>`;

        const doc = parseHtml(html);
        const result = querySelectorNamespaced(
          doc,
          "nav",
          'type="toc"',
          "epub",
        );

        expect(result).toBeTruthy();
        expect(result?.querySelector("h1")?.textContent).toBe("HTML TOC");
      });

      it("should handle HTML5 with namespaced attributes", () => {
        const html = `<!DOCTYPE html>
          <html>
            <body>
              <nav epub:type="toc">
                <h1>HTML5 TOC</h1>
              </nav>
            </body>
          </html>`;

        const doc = parseHtml(html);

        // In HTML mode, the escaped selector should work
        const element = doc.querySelector('nav[epub\\:type="toc"]');
        expect(element).toBeTruthy();

        // Our helper should also find it
        const result = querySelectorNamespaced(
          doc,
          "nav",
          'type="toc"',
          "epub",
        );
        expect(result).toBeTruthy();
        expect(result?.querySelector("h1")?.textContent).toBe("HTML5 TOC");
      });

      it("should work without namespace parameter", () => {
        const html = `<!DOCTYPE html>
          <html>
            <body>
              <nav type="toc">
                <h1>Simple HTML TOC</h1>
              </nav>
            </body>
          </html>`;

        const doc = parseHtml(html);
        const result = querySelectorNamespaced(doc, "nav", 'type="toc"');

        expect(result).toBeTruthy();
        expect(result?.querySelector("h1")?.textContent).toBe(
          "Simple HTML TOC",
        );
      });
    });

    describe("Edge cases", () => {
      it("should handle null namespace parameter", () => {
        const xml = `<?xml version="1.0"?>
          <root>
            <nav type="toc">
              <h1>TOC</h1>
            </nav>
          </root>`;

        const doc = parseXml(xml);
        const result = querySelectorNamespaced(doc, "nav", 'type="toc"', null);

        expect(result).toBeTruthy();
        expect(result?.querySelector("h1")?.textContent).toBe("TOC");
      });

      it("should handle undefined namespace parameter", () => {
        const xml = `<?xml version="1.0"?>
          <root>
            <nav type="toc">
              <h1>TOC</h1>
            </nav>
          </root>`;

        const doc = parseXml(xml);
        const result = querySelectorNamespaced(
          doc,
          "nav",
          'type="toc"',
          undefined,
        );

        expect(result).toBeTruthy();
        expect(result?.querySelector("h1")?.textContent).toBe("TOC");
      });

      it("should work with nested elements", () => {
        const xml = `<?xml version="1.0"?>
          <root xmlns:epub="http://www.idpf.org/2007/ops">
            <div>
              <nav epub:type="toc">
                <h1>Nested TOC</h1>
              </nav>
            </div>
          </root>`;

        const doc = parseXml(xml);
        const div = doc.querySelector("div");
        expect(div).toBeTruthy();

        if (div) {
          const result = querySelectorNamespaced(
            div,
            "nav",
            'type="toc"',
            "epub",
          );
          expect(result).toBeTruthy();
          expect(result?.querySelector("h1")?.textContent).toBe("Nested TOC");
        }
      });

      it("should handle case sensitivity correctly", () => {
        const xml = `<?xml version="1.0"?>
          <root xmlns:EPUB="http://www.idpf.org/2007/ops">
            <nav EPUB:type="toc">
              <h1>Case Test</h1>
            </nav>
          </root>`;

        const doc = parseXml(xml);
        // XML is case-sensitive, so this should work with exact case
        const result = querySelectorNamespaced(
          doc,
          "nav",
          'type="toc"',
          "EPUB",
        );

        expect(result).toBeTruthy();
        expect(result?.querySelector("h1")?.textContent).toBe("Case Test");
      });
    });

    describe("Additional tests", () => {
      it("should handle SVG namespaces", () => {
        const svg = `<?xml version="1.0"?>
          <svg xmlns="http://www.w3.org/2000/svg" xmlns:custom="http://example.com">
            <g custom:type="toc">
              <text>SVG TOC</text>
            </g>
          </svg>`;

        const doc = parseXml(svg);
        const result = querySelectorNamespaced(
          doc,
          "g",
          'type="toc"',
          "custom",
        );

        expect(result).toBeTruthy();
        const text = result?.querySelector("text");
        expect(text?.textContent).toBe("SVG TOC");
      });
    });
  };
}
