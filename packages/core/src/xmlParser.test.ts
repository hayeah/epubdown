import { describe, expect, it } from "vitest";
import { parseHtml, parseXml } from "./xmlParser";

/**
 * This test suite documents how linkedom's HTML/XML parsing behavior
 * compares to standard browser implementations.
 *
 * Legend:
 * - ✅ STANDARD: Behavior matches W3C specifications
 * - ❌ DEVIATION: Behavior differs from standard parsers
 * - ⚠️  PARTIAL: Partially correct behavior
 */
describe("xmlParser - linkedom parsing mode differences", () => {
  describe("HTML vs XML parsing differences", () => {
    it("should handle case sensitivity differently", () => {
      /**
       * ✅ STANDARD HTML: querySelector is case-insensitive
       * ⚠️  PARTIAL XML: Tag names preserve case (correct), but linkedom
       *     incorrectly lowercases element names in its internal representation
       */
      const markup = "<DIV><SPAN>test</SPAN></DIV>";

      const htmlDoc = parseHtml(markup);
      const xmlDoc = parseXml(markup);

      // In HTML mode, tag names should be lowercase
      const htmlDiv = htmlDoc.querySelector("div");
      expect(htmlDiv).toBeTruthy();
      expect(htmlDiv?.tagName).toBe("DIV"); // linkedom might uppercase this

      // In XML mode, tag names should preserve case
      const xmlDiv = xmlDoc.querySelector("DIV");
      expect(xmlDiv).toBeTruthy();
      expect(xmlDiv?.tagName).toBe("DIV");
    });

    it("should handle self-closing tags differently", () => {
      /**
       * ✅ STANDARD: Both HTML and XML accept self-closing syntax
       *     HTML5 allows self-closing on void elements
       *     XML requires all tags to be closed
       */
      const markup = "<br/><img src='test.jpg'/>";

      const htmlDoc = parseHtml(markup);
      const xmlDoc = parseXml(markup);

      // Both should parse successfully
      expect(htmlDoc.querySelector("br")).toBeTruthy();
      expect(xmlDoc.querySelector("br")).toBeTruthy();
    });

    it("should handle void elements differently", () => {
      /**
       * ✅ STANDARD HTML: Void elements like <br> don't need closing
       * ❌ DEVIATION XML: linkedom accepts unclosed tags and incorrectly
       *     serializes them with closing tags like </br>
       *     (Standard XML should either reject or use self-closing <br/>)
       */
      // Test using the SAME markup with unclosed <br> tag
      const markup = "<div><br><span>test</span></div>";

      const htmlDoc = parseHtml(markup);
      const xmlDoc = parseXml(markup);

      // HTML should parse successfully
      expect(htmlDoc.querySelector("br")).toBeTruthy();
      expect(htmlDoc.querySelector("span")?.textContent).toBe("test");

      // XML should fail or produce error, but linkedom accepts it
      expect(xmlDoc.querySelector("br")).toBeTruthy();
      expect(xmlDoc.querySelector("span")?.textContent).toBe("test");

      // Check if linkedom created a parsererror (it doesn't)
      const parseError = xmlDoc.querySelector("parsererror");
      expect(parseError).toBeFalsy(); // Should be truthy in standard XML parser

      // Check how linkedom serializes the parsed XML
      // Get the root element's outerHTML
      const rootElement = xmlDoc.documentElement;
      const serializedXml = rootElement?.outerHTML || "";
      console.log("Serialized XML with unclosed br:", serializedXml);

      // linkedom auto-closes with </br> which is incorrect
      // In XML, void elements should be self-closing: <br/>
      expect(serializedXml).toBe("<div><br><span>test</span></br></div>");

      // This is wrong! Standard XML would either:
      // 1. Fail to parse (throw error)
      // 2. Auto-correct to <br/> (self-closing)
      // But linkedom creates invalid </br> closing tag
    });

    it("should handle namespaces differently", () => {
      /**
       * ❌ DEVIATION XML: linkedom doesn't properly support XML namespaces
       *     - getElementsByTagNameNS() doesn't work
       *     - Elements get default XHTML namespace instead of custom namespace
       *     - Namespace prefixes treated as part of tag name
       * ✅ STANDARD HTML: Treats namespace prefixes as part of tag name
       */
      const markup =
        '<root xmlns:custom="http://example.com"><custom:element>test</custom:element></root>';

      const htmlDoc = parseHtml(markup);
      const xmlDoc = parseXml(markup);

      // Log what linkedom actually creates
      console.log(
        "XML document type:",
        xmlDoc.nodeType,
        xmlDoc.constructor.name,
      );
      console.log("XML root element:", xmlDoc.documentElement?.tagName);
      console.log(
        "XML namespace handling - getElementsByTagNameNS:",
        xmlDoc.getElementsByTagNameNS("http://example.com", "element").length,
      );
      console.log(
        "XML namespace handling - getElementsByTagName:",
        xmlDoc.getElementsByTagName("custom:element").length,
      );

      // Try different approaches
      const xmlCustomElement = xmlDoc.getElementsByTagName("custom:element")[0];
      if (xmlCustomElement) {
        console.log("XML element found by tagName:", xmlCustomElement.tagName);
        console.log("XML element namespace:", xmlCustomElement.namespaceURI);
        expect(xmlCustomElement.textContent).toBe("test");
      }

      // HTML might treat it as a regular element with colon in name
      const htmlElements = htmlDoc.getElementsByTagName("custom:element");
      console.log("HTML elements found:", htmlElements.length);
    });

    it("should handle CDATA sections differently", () => {
      /**
       * ✅ STANDARD XML: CDATA sections preserve literal text
       * ⚠️  PARTIAL HTML: linkedom strips CDATA in HTML mode
       *     (HTML5 spec says CDATA is only for foreign content like SVG/MathML)
       */
      const markup = "<root><![CDATA[<test>& special chars</test>]]></root>";

      const htmlDoc = parseHtml(markup);
      const xmlDoc = parseXml(markup);

      // XML should preserve CDATA content as text
      const xmlRoot = xmlDoc.querySelector("root");
      expect(xmlRoot?.textContent).toBe("<test>& special chars</test>");

      // HTML might handle it differently
      const htmlRoot = htmlDoc.querySelector("root");
      console.log("HTML CDATA handling:", htmlRoot?.textContent);
    });

    it("should handle entities differently", () => {
      /**
       * ✅ STANDARD HTML: Recognizes all HTML entities (&nbsp;, &copy;, etc.)
       * ✅ STANDARD XML: Only recognizes 5 predefined entities
       *     (&lt;, &gt;, &amp;, &quot;, &apos;)
       *     Other entities remain as literal text
       */
      const markup = "<root>&nbsp;&copy;&lt;test&gt;</root>";

      const htmlDoc = parseHtml(markup);
      const xmlDoc = parseXml(markup);

      // HTML should recognize HTML entities
      const htmlRoot = htmlDoc.querySelector("root");
      expect(htmlRoot?.textContent).toContain("\u00A0"); // nbsp
      expect(htmlRoot?.textContent).toContain("©");
      expect(htmlRoot?.textContent).toContain("<test>");

      // XML only recognizes basic entities (&lt;, &gt;, &amp;, &quot;, &apos;)
      const xmlRoot = xmlDoc.querySelector("root");
      console.log("XML entity handling:", xmlRoot?.textContent);
    });

    it("should handle malformed content differently", () => {
      /**
       * ✅ STANDARD HTML: Forgiving parser, attempts to fix errors
       * ❌ DEVIATION XML: linkedom doesn't enforce well-formedness
       *     Standard XML parsers should fail or generate parsererror
       */
      const malformed = "<div><p>unclosed paragraph<div>nested</div>";

      // HTML should be more forgiving
      const htmlDoc = parseHtml(malformed);
      expect(htmlDoc.querySelector("div")).toBeTruthy();
      expect(htmlDoc.querySelectorAll("div").length).toBeGreaterThan(0);

      // XML should be strict (might throw or create error document)
      const xmlDoc = parseXml(malformed);
      const parseError = xmlDoc.querySelector("parsererror");
      console.log("XML parse error element:", parseError?.textContent);
    });

    it("should handle attributes differently", () => {
      /**
       * ✅ STANDARD HTML: Allows unquoted attributes
       * ❌ DEVIATION XML: linkedom accepts unquoted attributes
       *     (XML requires all attribute values to be quoted)
       * ✅ STANDARD: Both modes keep only first duplicate attribute
       */
      // Unquoted attributes, duplicate attributes
      const markup = '<div id=test class="foo" class="bar"></div>';

      const htmlDoc = parseHtml(markup);
      const xmlDoc = parseXml(markup);

      const htmlDiv = htmlDoc.querySelector("div");
      expect(htmlDiv?.getAttribute("id")).toBe("test");
      console.log("HTML class attribute:", htmlDiv?.getAttribute("class"));

      const xmlDiv = xmlDoc.querySelector("div");
      console.log("XML id attribute:", xmlDiv?.getAttribute("id"));
      console.log("XML class attribute:", xmlDiv?.getAttribute("class"));
    });
  });
});
