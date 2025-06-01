import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Metadata } from "../src/Metadata";
import { compareOrUpdateFixture } from "../src/testUtils";

describe("Metadata", () => {
  describe("fromXml()", () => {
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
          metadata.toJSON(),
        );
      });
    }
  });
});
