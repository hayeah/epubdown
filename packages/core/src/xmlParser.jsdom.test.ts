import { describe, expect, it } from "vitest";
import { parseXml } from "./xmlParser";

/**
 * This test suite demonstrates how jsdom's XML parsing behavior
 * is more compliant with W3C XML specifications compared to linkedom.
 *
 * Legend:
 * - ✅ COMPLIANT: Behavior matches W3C XML specifications
 * - ❌ NON-COMPLIANT: Behavior deviates from standards
 */
describe("xmlParser - jsdom XML parsing compliance", () => {
  describe("XML namespace support", () => {
    it("should properly support XML namespaces", () => {
      /**
       * ✅ COMPLIANT: jsdom properly supports XML namespaces
       * - getElementsByTagNameNS() works correctly
       * - Elements have correct namespace URIs
       * - Namespace prefixes are handled properly
       */
      const markup =
        '<root xmlns:custom="http://example.com"><custom:element>test</custom:element></root>';

      const xmlDoc = parseXml(markup);

      // Check namespace-aware methods
      const elementsNS = xmlDoc.getElementsByTagNameNS(
        "http://example.com",
        "element",
      );
      expect(elementsNS.length).toBe(1);
      expect(elementsNS[0]?.textContent).toBe("test");

      // Check element namespace properties
      const customElement = xmlDoc.getElementsByTagName("custom:element")[0];
      expect(customElement).toBeTruthy();
      expect(customElement?.namespaceURI).toBe("http://example.com");
      expect(customElement?.localName).toBe("element");
      expect(customElement?.prefix).toBe("custom");
    });

    it("should handle default namespaces correctly", () => {
      /**
       * ✅ COMPLIANT: jsdom correctly handles default namespaces
       */
      const markup =
        '<root xmlns="http://example.com/default"><child>content</child></root>';

      const xmlDoc = parseXml(markup);

      const root = xmlDoc.documentElement;
      expect(root.namespaceURI).toBe("http://example.com/default");

      const child = xmlDoc.getElementsByTagNameNS(
        "http://example.com/default",
        "child",
      )[0];
      expect(child).toBeTruthy();
      expect(child?.textContent).toBe("content");
    });
  });

  describe("XML well-formedness enforcement", () => {
    it("should reject unclosed tags", () => {
      /**
       * ✅ COMPLIANT: jsdom enforces XML well-formedness
       * Malformed XML should produce a parsererror
       */
      const malformed = "<div><p>unclosed paragraph<div>nested</div>";

      const xmlDoc = parseXml(malformed);

      // Check for parsererror element
      const parseError = xmlDoc.querySelector("parsererror");
      expect(parseError).toBeTruthy();
      expect(parseError?.textContent).toContain("unclosed tag");
    });

    it("should reject unclosed void elements", () => {
      /**
       * ✅ COMPLIANT: In XML, all elements must be properly closed
       * Void elements must use self-closing syntax
       */
      const invalidXml = "<div><br><span>test</span></div>";

      const xmlDoc = parseXml(invalidXml);

      // Should have a parsererror
      const parseError = xmlDoc.querySelector("parsererror");
      expect(parseError).toBeTruthy();
    });

    it("should accept self-closing void elements", () => {
      /**
       * ✅ COMPLIANT: Self-closing syntax is valid in XML
       */
      const validXml = "<div><br/><span>test</span></div>";

      const xmlDoc = parseXml(validXml);

      // Should parse successfully
      const parseError = xmlDoc.querySelector("parsererror");
      expect(parseError).toBeFalsy();

      expect(xmlDoc.querySelector("br")).toBeTruthy();
      expect(xmlDoc.querySelector("span")?.textContent).toBe("test");
    });
  });

  describe("Case sensitivity", () => {
    it("should preserve case in element names", () => {
      /**
       * ✅ COMPLIANT: XML is case-sensitive
       */
      const markup = "<DIV><SPAN>test</SPAN></DIV>";

      const xmlDoc = parseXml(markup);

      // Element names should preserve case
      const divElement = xmlDoc.querySelector("DIV");
      expect(divElement).toBeTruthy();
      expect(divElement?.tagName).toBe("DIV");
      expect(divElement?.nodeName).toBe("DIV");

      // Case-sensitive querySelector
      expect(xmlDoc.querySelector("div")).toBeFalsy(); // lowercase should not match
      expect(xmlDoc.querySelector("DIV")).toBeTruthy(); // uppercase should match
    });
  });

  describe("CDATA sections", () => {
    it("should properly handle CDATA sections", () => {
      /**
       * ✅ COMPLIANT: CDATA sections preserve literal text
       */
      const markup = "<root><![CDATA[<test>& special chars</test>]]></root>";

      const xmlDoc = parseXml(markup);

      const root = xmlDoc.querySelector("root");
      expect(root?.textContent).toBe("<test>& special chars</test>");

      // CDATA content should not be parsed as markup
      expect(xmlDoc.querySelector("test")).toBeFalsy();
    });
  });

  describe("Entity handling", () => {
    it("should only recognize XML predefined entities", () => {
      /**
       * ✅ COMPLIANT: XML only recognizes 5 predefined entities
       * (&lt;, &gt;, &amp;, &quot;, &apos;)
       */
      const markup =
        "<root>&lt;test&gt; &amp; &quot;quotes&quot; &apos;apostrophe&apos;</root>";

      const xmlDoc = parseXml(markup);

      const root = xmlDoc.querySelector("root");
      expect(root?.textContent).toBe("<test> & \"quotes\" 'apostrophe'");
    });

    it("should not recognize HTML entities", () => {
      /**
       * ✅ COMPLIANT: HTML entities like &nbsp; are not valid in XML
       * without DTD declaration
       */
      const markup = "<root>&nbsp;&copy;</root>";

      const xmlDoc = parseXml(markup);

      // Should produce a parsererror for undefined entities
      const parseError = xmlDoc.querySelector("parsererror");
      expect(parseError).toBeTruthy();
    });
  });

  describe("Attribute handling", () => {
    it("should require quoted attribute values", () => {
      /**
       * ✅ COMPLIANT: XML requires all attribute values to be quoted
       */
      const unquotedAttr = "<div id=test></div>";

      const xmlDoc = parseXml(unquotedAttr);

      // Should have a parsererror
      const parseError = xmlDoc.querySelector("parsererror");
      expect(parseError).toBeTruthy();
    });

    it("should handle duplicate attributes", () => {
      /**
       * ✅ COMPLIANT: Duplicate attributes are not allowed in XML
       */
      const duplicateAttr = '<div class="foo" class="bar"></div>';

      const xmlDoc = parseXml(duplicateAttr);

      // Should have a parsererror
      const parseError = xmlDoc.querySelector("parsererror");
      expect(parseError).toBeTruthy();
    });
  });

  describe("Processing instructions and comments", () => {
    it("should handle XML processing instructions", () => {
      /**
       * ✅ COMPLIANT: Processing instructions are supported
       */
      const markup =
        '<?xml version="1.0" encoding="UTF-8"?><root><?custom-pi data?></root>';

      const xmlDoc = parseXml(markup);

      expect(xmlDoc.querySelector("root")).toBeTruthy();

      // Find processing instruction
      const root = xmlDoc.documentElement;
      let piFound = false;
      for (let i = 0; i < root.childNodes.length; i++) {
        const node = root.childNodes[i];
        if (node && node.nodeType === 7) {
          // PROCESSING_INSTRUCTION_NODE
          piFound = true;
          expect(node.nodeName).toBe("custom-pi");
          expect(node.nodeValue).toBe("data");
        }
      }
      expect(piFound).toBe(true);
    });

    it("should preserve comments", () => {
      /**
       * ✅ COMPLIANT: Comments are preserved in XML
       */
      const markup = "<root><!-- This is a comment --><element/></root>";

      const xmlDoc = parseXml(markup);

      const root = xmlDoc.documentElement;
      let commentFound = false;
      for (let i = 0; i < root.childNodes.length; i++) {
        const node = root.childNodes[i];
        if (node && node.nodeType === 8) {
          // COMMENT_NODE
          commentFound = true;
          expect(node.nodeValue).toBe(" This is a comment ");
        }
      }
      expect(commentFound).toBe(true);
    });
  });
});
