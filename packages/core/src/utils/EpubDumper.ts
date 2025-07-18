import { promises as fs } from "node:fs";
import { basename, dirname, join } from "node:path";
import { ContentToMarkdown } from "../ContentToMarkdown";
import { EPubMarkdownConverter } from "../EPubMarkdownConverter";
import { EPub } from "../Epub";
import { FileDataResolver } from "../Epub";
import { unzip } from "./zipUtils";

interface DumpOptions {
  verbose?: boolean;
  outputDir?: string;
}

export class EpubDumper {
  private converter: ContentToMarkdown;
  private epubMarkdownConverter: EPubMarkdownConverter;
  private outputDir: string;

  constructor(
    private readonly epub: EPub,
    private readonly baseDir: string,
    private readonly options: DumpOptions = {},
  ) {
    this.converter = ContentToMarkdown.create();
    this.epubMarkdownConverter = new EPubMarkdownConverter(this.epub);
    this.outputDir = options.outputDir || baseDir;
  }

  static async fromZipFile(
    epubFile: string,
    options?: DumpOptions,
  ): Promise<EpubDumper> {
    // Extract zip file to output directory
    const outputDir =
      options?.outputDir || `${basename(epubFile, ".epub")}_dump`;
    await unzip(epubFile, outputDir);

    // Call fromDirectory with the extracted content
    return EpubDumper.fromDirectory(outputDir, options);
  }

  static async fromDirectory(
    dir: string,
    options?: DumpOptions,
  ): Promise<EpubDumper> {
    const epub = await EPub.init(new FileDataResolver(dir));
    return new EpubDumper(epub, dir, options);
  }

  private async time<T>(msg: string, fn: () => Promise<T>): Promise<T> {
    if (!this.options.verbose) {
      return fn();
    }

    const startTime = performance.now();
    const result = await fn();
    const elapsed = performance.now() - startTime;
    if (elapsed > 100) {
      console.log(`  [${elapsed.toFixed(2)}ms] ${msg}`);
    }
    return result;
  }

  private slug(text: string): string {
    return (
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50) || "untitled"
    );
  }

  private async writeFile(
    relativePath: string,
    content: string,
  ): Promise<void> {
    const fullPath = join(this.outputDir, relativePath);
    await fs.mkdir(dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf8");
  }

  private async writeJSON(relativePath: string, data: unknown): Promise<void> {
    await this.writeFile(relativePath, JSON.stringify(data, null, 2));
  }

  async dump(): Promise<void> {
    if (this.options.verbose) {
      console.log(`Dumping EPUB from: ${this.baseDir}`);
      if (this.outputDir !== this.baseDir) {
        console.log(`Output directory: ${this.outputDir}`);
      }
    }

    // Initialize TOC anchor links (will be cached in epub instance)
    const tocAnchorLinks = await this.epub.tocAnchorLinks();
    if (this.options.verbose) {
      console.log(`Found ${tocAnchorLinks.size} files with TOC anchors`);
    }

    // Dump root level metadata files
    await this.dumpMetadataFiles();

    // Dump chapters
    await this.dumpChapters();

    if (this.options.verbose) {
      console.log(`Dump completed in: ${this.outputDir}`);
    }
  }

  private async dumpMetadataFiles(): Promise<void> {
    // Dump container XML
    await this.writeFile("container.dump.xml", this.epub.container.content);

    // Dump OPF
    await this.writeFile("opf.dump.xml", this.epub.opf.content);

    // Dump metadata
    const metadata = this.epub.getMetadata();
    await this.writeJSON("metadata.dump.json", metadata);

    // Dump manifest
    const manifest = this.epub.getManifest();
    await this.writeJSON("manifest.dump.json", manifest);

    // Dump spine with manifest context
    const spineManifest = this.epub.getSpineWithManifest(false);
    await this.writeJSON("spineManifest.dump.json", spineManifest);

    // Dump nav file if exists
    const navFile = await this.epub.nav();
    if (navFile) {
      if (this.options.verbose) {
        console.log(`Found nav file: ${navFile.path}`);
      }
      await this.writeFile("nav.dump.xml", navFile.content);

      // Convert nav to markdown
      await this.time("nav.md", async () => {
        const navMarkdown = await this.converter.convert(navFile.content);
        await this.writeFile("nav.dump.md", navMarkdown);
      });
    }

    // Dump NCX file if exists
    const ncxFile = await this.epub.ncx();
    if (ncxFile) {
      if (this.options.verbose) {
        console.log(`Found NCX file: ${ncxFile.path}`);
      }
      await this.writeFile("ncx.dump.xml", ncxFile.content);

      // Convert NCX to HTML
      const ncxHtml = await this.epub.ncxToHTML();
      if (ncxHtml) {
        await this.writeFile("ncx.dump.html", ncxHtml.content);

        // Convert the HTML version to markdown
        await this.time("ncx.md", async () => {
          const ncxMarkdown = await this.converter.convert(ncxHtml.content);
          await this.writeFile("ncx.dump.md", ncxMarkdown);
        });
      }
    }
  }

  private async dumpChapters(): Promise<void> {
    const chapterList: Array<{ index: number; title: string; path: string }> =
      [];
    let index = 0;

    for await (const chapter of this.epub.getChapters(false)) {
      index += 1;

      await this.time(`chapter ${index}`, async () => {
        // Get markdown content
        const content = await this.epubMarkdownConverter.getChapterMD(chapter);

        // Extract title from the content (typically the first H1)
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : "Chapter";

        // Write markdown beside the original file
        const mdPath = chapter.path.replace(/\.(x?html?)$/i, ".dump.md");
        await this.writeFile(mdPath, content);

        // Add to chapter list
        chapterList.push({
          index,
          title: title || "Chapter",
          path: chapter.path,
        });
      });
    }

    // Write chapter list to root
    await this.writeJSON("chapters.dump.json", chapterList);
  }
}
