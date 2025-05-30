#!/usr/bin/env bun
import fs from "node:fs/promises";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EPubMarkdownConverter } from "../EPubMarkdownConverter";
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

async function time<T>(msg: string, fn: () => Promise<T>): Promise<T> {
  const startTime = performance.now();
  const result = await fn();
  const elapsed = performance.now() - startTime;
  if (elapsed > 100) {
    console.log(`  [${elapsed.toFixed(2)}ms] ${msg}`);
  }
  return result;
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

  // Initialize TOC anchor links (will be cached in epub instance)
  const tocAnchorLinks = await epub.tocAnchorLinks();
  console.log(`Found ${tocAnchorLinks.size} files with TOC anchors`);

  const converter = new MarkdownConverter();
  const epubMarkdownConverter = new EPubMarkdownConverter(epub);

  // Dump nav file if exists
  const navFile = await epub.nav();
  if (navFile) {
    console.log(`Found nav file: ${navFile.path}`);
    await outputFile("nav.xml", navFile.content);

    // Convert nav to markdown
    await time("nav.md", async () => {
      const { content: navMarkdown } = await converter.convertXMLFile(navFile);
      await outputFile("nav.md", navMarkdown);
    });
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
      await time("ncx.md", async () => {
        const { content: ncxMarkdown } =
          await converter.convertXMLFile(ncxHtml);
        await outputFile("ncx.md", ncxMarkdown);
      });
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

    await time(`chapter ${index}`, async () => {
      // Get markdown with all metadata
      const { title, content } =
        await epubMarkdownConverter.getChapterMarkdown(chapter);

      const base = `${String(index).padStart(4, "0")}_${slug(
        title || "chapter",
      )}`;

      // HTML
      await outputChapterFile(`${base}.html`, chapter.content);

      // Markdown
      await outputChapterFile(`${base}.md`, content);
    });
  }

  console.log(`wrote → ${baseDir}`);
}

interface Args {
  _: string[];
  dir?: string;
  [x: string]: unknown;
}

async function main() {
  const argv = (await yargs(hideBin(process.argv))
    .usage("Usage: $0 <input> [options]")
    .positional("input", {
      describe: "Path to EPUB file or directory containing EPUB files",
      type: "string",
    })
    .option("dir", {
      alias: "d",
      type: "string",
      description: "Output directory (default: input path + '.dump')",
    })
    .demandCommand(1, "Please provide an input path")
    .help()
    .alias("help", "h")
    .parse()) as Args;

  const targetPath = argv._[0];
  if (!targetPath) {
    console.error("Error: No input path provided");
    process.exit(1);
  }

  // Check if target is a single EPUB file
  try {
    const stats = await fs.stat(targetPath);

    if (stats.isFile() && targetPath.toLowerCase().endsWith(".epub")) {
      // Single EPUB file
      console.log(`Dumping single EPUB: ${targetPath}`);

      // Default output dir is same directory as input file
      let dumpDir = `${path.dirname(targetPath)}.dump`;
      if (argv.dir) {
        dumpDir = argv.dir;
      }

      await dumpSingle(targetPath, dumpDir);
    } else if (stats.isDirectory()) {
      // Directory of EPUBs
      console.log(`Looking for EPUBs in: ${targetPath}`);

      // Default output dir is input directory + .dump
      let dumpDir = `${targetPath}.dump`;
      if (argv.dir) {
        dumpDir = argv.dir;
      }

      const entries = await fs.readdir(targetPath);

      for (const entry of entries) {
        if (!entry.toLowerCase().endsWith(".epub")) continue;
        const fullPath = path.join(targetPath, entry);
        try {
          await dumpSingle(fullPath, dumpDir);
        } catch (error) {
          console.error(`Error dumping ${fullPath}:`, error);
        }
      }
    } else {
      console.error(
        `Error: ${targetPath} is neither a .epub file nor a directory`,
      );
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error accessing ${targetPath}:`, error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
