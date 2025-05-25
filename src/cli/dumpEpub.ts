#!/usr/bin/env bun
import fs from "node:fs/promises";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EPub } from "../Epub";
import { MarkdownConverter } from "../MarkdownConverter";

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "untitled"
  );
}

async function dumpSingle(epubPath: string, dumpDir: string) {
  // Helper function to write files relative to the baseDir
  console.log(`dumping ${epubPath}`);
  const raw = await fs.readFile(epubPath);
  const epub = await EPub.fromZip(raw);

  // Create directories first
  const epubBaseName = path.basename(epubPath, ".epub");
  const baseDir = path.join(dumpDir, `${epubBaseName}.dump`);
  const chaptersDir = path.join(baseDir, "chapters");

  const outputFile = async (filePath: string, data: string) => {
    await fs.writeFile(path.join(baseDir, filePath), data, "utf8");
  };

  // Helper function to write files to chapters directory
  const outputChapterFile = async (filePath: string, data: string) => {
    await fs.writeFile(path.join(chaptersDir, filePath), data, "utf8");
  };

  const outputJSON = async (filePath: string, data: unknown) => {
    await outputFile(filePath, JSON.stringify(data, null, 2));
  };

  await fs.mkdir(chaptersDir, { recursive: true });

  // // Import XMLSerializer from linkedom for Node.js environment
  // const { XMLSerializer } = await import("linkedom");
  // const serializer = new XMLSerializer();

  // Dump container XML and OPF
  await outputFile("container.xml", epub.container.content);
  await outputFile("opf.xml", epub.opf.content);

  const converter = new MarkdownConverter();

  // Dump nav file if exists
  const navFile = await epub.nav();
  if (navFile) {
    console.log(`Found nav file: ${navFile.path}`);
    await outputFile("nav.xml", navFile.content);

    // Convert nav to markdown
    const { content: navMarkdown } = await converter.convertXMLFile(navFile);
    await outputFile("nav.md", navMarkdown);
  }

  // Dump NCX file if exists
  const ncxFile = await epub.ncx();
  if (ncxFile) {
    console.log(`Found NCX file: ${ncxFile.path}`);
    await outputFile("ncx.xml", ncxFile.content);

    // Convert NCX to HTML
    const ncxHtml = await epub.ncxToHTML();
    if (ncxHtml) {
      await outputFile("ncx.html", ncxHtml.content);

      // Convert the HTML version to markdown
      const { content: ncxMarkdown } = await converter.convertXMLFile(ncxHtml);
      await outputFile("ncx.md", ncxMarkdown);
    }
  }

  // Get metadata
  const metadata = epub.getMetadata();
  await outputJSON("metadata.json", metadata);

  const manifest = epub.getManifest();
  // Dump manifest
  await outputJSON("manifest.json", manifest);

  // Dump spine with manifest context
  const spineManifest = epub.getSpineWithManifest(false);
  await outputJSON("spineManifest.json", spineManifest);

  // Process chapters
  let index = 0;
  for await (const chapter of epub.getChapters(false)) {
    index += 1;
    const { title } = await converter.convertXMLFile(chapter);
    const base = `${String(index).padStart(4, "0")}_${slug(
      title || "chapter",
    )}`;

    // HTML
    await outputChapterFile(`${base}.html`, chapter.content);

    // Markdown
    const { content } = await converter.convertXMLFile(chapter);
    await outputChapterFile(`${base}.md`, content);
  }

  console.log(`wrote → ${baseDir}`);
}

interface Args {
  dir: string;
  [x: string]: unknown;
}

async function main() {
  const argv = (await yargs(hideBin(process.argv))
    .option("dir", {
      alias: "d",
      type: "string",
      description: "Directory containing EPUB files",
      default: path.join(import.meta.dir, "../../epubs"),
    })
    .option("output", {
      alias: "o",
      type: "string",
      description: "Custom output directory for all EPUBs",
    })
    .help()
    .alias("help", "h")
    .parse()) as Args & { output?: string };

  const epubsDir = argv.dir;
  console.log(`Looking for EPUBs in: ${epubsDir}`);

  let dumpDir = `${epubsDir}.dump`;
  if (argv.output) {
    dumpDir = argv.output;
  }

  try {
    const entries = await fs.readdir(epubsDir);

    for (const entry of entries) {
      if (!entry.toLowerCase().endsWith(".epub")) continue;
      const fullPath = path.join(epubsDir, entry);
      try {
        await dumpSingle(fullPath, dumpDir);
      } catch (error) {
        console.error(`Error dumping ${fullPath}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${epubsDir}:`, error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
