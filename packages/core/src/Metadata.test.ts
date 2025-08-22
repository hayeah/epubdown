import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EPub } from "./Epub";
import { Metadata } from "./Metadata";
import { compareOrUpdateFixture, fetchEpub } from "./testUtils";
import { parseDocument } from "./xmlParser";

describe("Metadata", () => {
  describe("unit tests", () => {
    it("should create an empty metadata instance", () => {
      const metadata = new Metadata();
      expect(metadata.getProperties("title")).toEqual([]);
      expect(metadata.getText("title")).toBeUndefined();
      expect(metadata.toJSONFull()).toEqual({});
    });

    it("should add DC properties", () => {
      const metadata = new Metadata();

      metadata.addDC("title", "Test Title");
      metadata.addDC("creator", "Test Author", { id: "author1", role: "aut" });
      metadata.addDC("creator", "Test Editor", { id: "editor1", role: "edt" });

      expect(metadata.getProperties("title")).toHaveLength(1);
      expect(metadata.getProperties("title")[0]).toEqual({
        name: "title",
        value: "Test Title",
        attributes: {},
        refinements: new Map(),
      });

      expect(metadata.getProperties("creator")).toHaveLength(2);
      expect(metadata.getText("creator")).toBe("Test Author");

      expect(metadata.getById("author1")).toEqual({
        name: "creator",
        value: "Test Author",
        attributes: { id: "author1", role: "aut" },
        refinements: new Map(),
      });
    });

    it("should add meta refinements to DC properties", () => {
      const metadata = new Metadata();

      metadata.addDC("creator", "Jane Doe", { id: "creator1" });
      metadata.addMeta({
        property: "role",
        value: "aut",
        refines: "#creator1",
      });
      metadata.addMeta({
        property: "file-as",
        value: "Doe, Jane",
        refines: "#creator1",
      });

      const creator = metadata.getById("creator1");
      expect(creator?.refinements.get("role")).toEqual(["aut"]);
      expect(creator?.refinements.get("file-as")).toEqual(["Doe, Jane"]);
    });

    it("should ignore meta without refines", () => {
      const metadata = new Metadata();

      metadata.addDC("title", "Test", { id: "title1" });
      metadata.addMeta({
        property: "dcterms:modified",
        value: "2024-01-01T00:00:00Z",
      });

      const title = metadata.getById("title1");
      expect(title?.refinements.size).toBe(0);
    });

    it("should ignore meta with unknown refines target", () => {
      const metadata = new Metadata();

      metadata.addDC("title", "Test", { id: "title1" });
      metadata.addMeta({
        property: "display-seq",
        value: "1",
        refines: "#unknown",
      });

      const title = metadata.getById("title1");
      expect(title?.refinements.size).toBe(0);
    });

    it("should handle multiple refinements of the same property", () => {
      const metadata = new Metadata();

      metadata.addDC("creator", "Author Name", { id: "author1" });
      metadata.addMeta({
        property: "role",
        value: "aut",
        refines: "#author1",
      });
      metadata.addMeta({
        property: "role",
        value: "ill",
        refines: "#author1",
      });

      const author = metadata.getById("author1");
      expect(author?.refinements.get("role")).toEqual(["aut", "ill"]);
    });

    it("should handle getById with and without # prefix", () => {
      const metadata = new Metadata();

      metadata.addDC("title", "Test", { id: "title1" });

      expect(metadata.getById("title1")).toBeDefined();
      expect(metadata.getById("#title1")).toBeDefined();
      expect(metadata.getById("title1")).toBe(metadata.getById("#title1"));
    });

    it("should support case-insensitive get method", () => {
      const metadata = new Metadata();

      metadata.addDC("title", "Test Title");
      metadata.addDC("CREATOR", "Test Author");
      metadata.addDC("dc:language", "en");

      // Test case-insensitive access
      expect(metadata.get("title")).toBe("Test Title");
      expect(metadata.get("Title")).toBe("Test Title");
      expect(metadata.get("TITLE")).toBe("Test Title");
      expect(metadata.get("creator")).toBe("Test Author");
      expect(metadata.get("Creator")).toBe("Test Author");
      expect(metadata.get("language")).toBe("en");
      expect(metadata.get("dc:language")).toBe("en");
      expect(metadata.get("DC:LANGUAGE")).toBe("en");

      // Test empty value
      expect(metadata.get("nonexistent")).toBe("");
    });

    it("should support getValues method", () => {
      const metadata = new Metadata();

      metadata.addDC("creator", "Author 1");
      metadata.addDC("creator", "Author 2");
      metadata.addDC("CREATOR", "Author 3");

      const values = metadata.getValues("creator");
      expect(values).toEqual(["Author 1", "Author 2", "Author 3"]);
      expect(metadata.getValues("CREATOR")).toEqual([
        "Author 1",
        "Author 2",
        "Author 3",
      ]);
      expect(metadata.getValues("nonexistent")).toEqual([]);
    });

    it("should convert to simple JSON", () => {
      const metadata = new Metadata();

      metadata.addDC("title", "Main Title");
      metadata.addDC("title", "Subtitle");
      metadata.addDC("creator", "Author");
      metadata.addDC("language", "en");

      const json = metadata.toJSON();

      expect(json).toEqual({
        title: "Main Title",
        creator: "Author",
        language: "en",
      });
    });

    it("should convert to full JSON correctly", () => {
      const metadata = new Metadata();

      metadata.addDC("title", "Main Title", { id: "title1" });
      metadata.addDC("title", "Subtitle", { id: "title2" });
      metadata.addDC("creator", "Author", { id: "author1" });

      metadata.addMeta({
        property: "display-seq",
        value: "1",
        refines: "#title1",
      });
      metadata.addMeta({
        property: "role",
        value: "aut",
        refines: "#author1",
      });

      const json = metadata.toJSONFull();

      expect(json).toEqual({
        title: [
          {
            value: "Main Title",
            attributes: { id: "title1" },
            refinements: { "display-seq": ["1"] },
          },
          {
            value: "Subtitle",
            attributes: { id: "title2" },
            refinements: {},
          },
        ],
        creator: [
          {
            value: "Author",
            attributes: { id: "author1" },
            refinements: { role: ["aut"] },
          },
        ],
      });
    });
  });

  describe("fromDom", () => {
    it("should parse metadata from DOM element", () => {
      const xml = `
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title id="t1">Test Title</dc:title>
          <dc:creator id="auth1">Test Author</dc:creator>
          <dc:language>en</dc:language>
          <meta property="role" refines="#auth1">aut</meta>
          <meta property="file-as" refines="#auth1">Author, Test</meta>
          <meta property="dcterms:modified">2024-01-01T00:00:00Z</meta>
        </metadata>
      `;

      const doc = parseDocument(xml, "xml");
      const metadataElement = doc.querySelector("metadata");
      if (!metadataElement) throw new Error("metadata element not found");
      const metadata = Metadata.fromDom(metadataElement);

      expect(metadata.getText("title")).toBe("Test Title");
      expect(metadata.getText("creator")).toBe("Test Author");
      expect(metadata.getText("language")).toBe("en");

      const author = metadata.getById("auth1");
      expect(author?.refinements.get("role")).toEqual(["aut"]);
      expect(author?.refinements.get("file-as")).toEqual(["Author, Test"]);
    });

    it("should handle empty text content", () => {
      const xml = `
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title></dc:title>
          <dc:creator id="auth1"></dc:creator>
          <meta property="role" refines="#auth1"></meta>
        </metadata>
      `;

      const doc = parseDocument(xml, "xml");
      const metadataElement = doc.querySelector("metadata");
      if (!metadataElement) throw new Error("metadata element not found");
      const metadata = Metadata.fromDom(metadataElement);

      expect(metadata.getText("title")).toBe("");
      expect(metadata.getText("creator")).toBe("");

      const author = metadata.getById("auth1");
      expect(author?.refinements.get("role")).toEqual([""]);
    });

    it("should collect all attributes from DC elements", () => {
      const xml = `
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"
                  xmlns:opf="http://www.idpf.org/2007/opf">
          <dc:creator id="auth1" opf:role="aut" opf:file-as="Author, Test">Test Author</dc:creator>
        </metadata>
      `;

      const doc = parseDocument(xml, "xml");
      const metadataElement = doc.querySelector("metadata");
      if (!metadataElement) throw new Error("metadata element not found");
      const metadata = Metadata.fromDom(metadataElement);

      const author = metadata.getProperties("creator")[0];
      expect(author).toBeDefined();
      expect(author?.attributes).toEqual({
        id: "auth1",
        "opf:role": "aut",
        "opf:file-as": "Author, Test",
      });
    });

    it("should skip non-dc and non-meta elements", () => {
      const xml = `
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Test Title</dc:title>
          <link href="cover.jpg" rel="cover-image"/>
          <unknown>Should be ignored</unknown>
          <meta name="cover" content="cover-image"/>
        </metadata>
      `;

      const doc = parseDocument(xml, "xml");
      const metadataElement = doc.querySelector("metadata");
      if (!metadataElement) throw new Error("metadata element not found");
      const metadata = Metadata.fromDom(metadataElement);

      expect(metadata.getProperties("title")).toHaveLength(1);
      expect(Object.keys(metadata.toJSONFull())).toEqual(["title"]);
    });
  });

  describe("fromXml", () => {
    it("should parse metadata from OPF XML string", () => {
      const opf = `<?xml version="1.0" encoding="UTF-8"?>
        <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title id="title">Sample Book</dc:title>
            <dc:creator id="creator">John Doe</dc:creator>
            <dc:identifier id="pub-id">urn:uuid:12345</dc:identifier>
            <dc:language>en-US</dc:language>
            <meta property="role" refines="#creator">aut</meta>
            <meta property="dcterms:modified">2024-01-01T00:00:00Z</meta>
          </metadata>
          <manifest>
            <item id="nav" href="nav.xhtml" properties="nav"/>
          </manifest>
          <spine>
            <itemref idref="nav"/>
          </spine>
        </package>
      `;

      const metadata = Metadata.fromXml(opf);

      expect(metadata.getText("title")).toBe("Sample Book");
      expect(metadata.getText("creator")).toBe("John Doe");
      expect(metadata.getText("identifier")).toBe("urn:uuid:12345");
      expect(metadata.getText("language")).toBe("en-US");

      const creator = metadata.getById("creator");
      expect(creator?.refinements.get("role")).toEqual(["aut"]);
    });

    it("should throw error if package element not found", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <root>
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title>Test</dc:title>
          </metadata>
        </root>
      `;

      expect(() => Metadata.fromXml(xml)).toThrow(
        "EPUB package element not found",
      );
    });

    it("should throw error if metadata element not found", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
          <manifest/>
        </package>
      `;

      expect(() => Metadata.fromXml(xml)).toThrow(
        "EPUB package metadata not found",
      );
    });
  });

  describe("integration with alice.epub", () => {
    it("should parse metadata from alice.epub", async () => {
      const epubData = await fetchEpub("alice.epub");
      const epub = await EPub.fromZip(epubData);
      const metadataElement = epub.opf.querySelector("metadata");
      expect(metadataElement).toBeTruthy();
      if (!metadataElement) throw new Error("metadata element not found");
      const metadata = Metadata.fromDom(metadataElement);

      // Compare with fixture
      const fixturePath = path.join(
        __dirname,
        "fixtures",
        "alice.metadata.json",
      );
      compareOrUpdateFixture(fixturePath, metadata.toJSONFull());
    });

    it("should parse metadata toJSON from alice.epub", async () => {
      const epubData = await fetchEpub("alice.epub");
      const epub = await EPub.fromZip(epubData);
      const metadataElement = epub.opf.querySelector("metadata");
      expect(metadataElement).toBeTruthy();
      if (!metadataElement) throw new Error("metadata element not found");
      const metadata = Metadata.fromDom(metadataElement);

      // Compare simple JSON with fixture
      const fixturePath = path.join(
        __dirname,
        "fixtures",
        "alice.metadata.simple.json",
      );
      compareOrUpdateFixture(fixturePath, metadata.toJSON());
    });
  });

  describe("fromXml() with OPF files", () => {
    // Find all OPF files in the fixtures directory
    const fixturesDir = path.resolve(__dirname, "fixtures");
    const opfFiles = fs
      .readdirSync(fixturesDir)
      .filter((file) => file.endsWith(".opf"));

    // Generate a test for each OPF file
    for (const opfFile of opfFiles) {
      const baseName = path.basename(opfFile, ".opf");
      const jsonFileName = `${baseName}.metadata.json`;

      it(`should parse metadata from ${opfFile}`, () => {
        // Read the OPF file
        const opfPath = path.join(fixturesDir, opfFile);
        const opfContent = fs.readFileSync(opfPath, "utf-8");

        // Parse the metadata
        const metadata = Metadata.fromXml(opfContent);

        // Compare with fixture or generate it
        compareOrUpdateFixture(
          path.join(fixturesDir, jsonFileName),
          metadata.toJSONFull(),
        );
      });
    }
  });
});
