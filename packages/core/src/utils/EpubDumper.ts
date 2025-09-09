import { promises as fs } from "node:fs";
import { basename, dirname, join } from "node:path";
import { ContentToMarkdown } from "../ContentToMarkdown";
import { EPub } from "../Epub";
import { FileDataResolver } from "../resolvers/FileDataResolver";
import { unzip } from "./zipUtils";

interface DumpOptions {
  verbose?: boolean;
  outputDir?: string;
  /**
   * When provided, dump only the Nth chapter (1-based) from the chapter iteration
   * rather than dumping all chapters and metadata.
   */
  onlyItemIndex?: number;
}

export class EpubDumper {
  private converter: ContentToMarkdown;
  private outputDir: string;

  constructor(
    private readonly epub: EPub,
    private readonly baseDir: string,
    private readonly options: DumpOptions = {},
  ) {
    this.converter = ContentToMarkdown.create();
    this.outputDir = options.outputDir || baseDir;
  }

  static async fromZipFile(
    epubFile: string,
    options?: DumpOptions,
  ): Promise<EpubDumper> {
    // Extract zip file to output directory in the same directory as the epub
    const epubDir = dirname(epubFile);
    const epubBasename = basename(epubFile);
    const outputDir =
      options?.outputDir || join(epubDir, `${epubBasename}.dump`);
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
    console.log(`  [${elapsed.toFixed(2)}ms] ${msg}`);
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

  private async writeFile(filePath: string, content: string): Promise<void> {
    // If the path is absolute, use it directly, otherwise join with outputDir
    const fullPath = filePath.startsWith("/")
      ? filePath
      : join(this.outputDir, filePath);
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
    const tocAnchorLinks = await this.epub.toc.anchorLinks();
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
    const metadata = this.epub.metadata;
    await this.writeJSON("metadata.dump.json", metadata.toJSON());

    // Dump manifest
    const manifest = this.epub.manifest();
    await this.writeJSON("manifest.dump.json", manifest);

    // Dump spine with manifest context
    const spineManifest = this.epub.spineWithManifest(false);
    await this.writeJSON("spineManifest.dump.json", spineManifest);

    // Dump nav file if exists
    const navFile = await this.epub.toc.nav();
    if (navFile) {
      if (this.options.verbose) {
        console.log(`Found nav file: ${navFile.path}`);
      }
      await this.writeFile("nav.dump.xml", navFile.content);

      // Convert nav to markdown
      await this.time("nav.md", async () => {
        const navMarkdown = await this.converter.convertXMLFile(navFile);
        await this.writeFile("nav.dump.md", navMarkdown);
      });
    }

    // Dump NCX file if exists
    const ncxFile = await this.epub.toc.ncx();
    if (ncxFile) {
      if (this.options.verbose) {
        console.log(`Found NCX file: ${ncxFile.path}`);
      }
      await this.writeFile("ncx.dump.xml", ncxFile.content);

      // Convert NCX to HTML
      const ncxHtml = await this.epub.toc.ncxToHTML();
      if (ncxHtml) {
        await this.writeFile("ncx.dump.html", ncxHtml.content);

        // Convert the HTML version to markdown
        await this.time("ncx.md", async () => {
          const ncxMarkdown = await this.converter.convertXMLFile(ncxHtml);
          await this.writeFile("ncx.dump.md", ncxMarkdown);
        });
      }
    }

    // Dump parsed TOC navigation items
    const navItems = await this.epub.toc.navItems();
    await this.writeJSON("toc.navItems.dump.json", navItems);

    // Dump flattened TOC navigation items
    const flatNavItems = await this.epub.toc.flatNavItems();
    await this.writeJSON("toc.flatNavItems.dump.json", flatNavItems);
  }

  private async dumpChapters(): Promise<void> {
    const chapterList: Array<{ index: number; title: string; path: string }> =
      [];
    let index = 0;
    const only = this.options.onlyItemIndex;

    for await (const chapter of this.epub.chapters(false)) {
      index += 1;
      if (only && index !== only) {
        continue;
      }

      await this.time(`item[${index}] ${chapter.path}`, async () => {
        // Get markdown content using chapter.path
        const content = await this.epub.chapterMarkdown(chapter.path);

        // Extract title from the content (typically the first H1)
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : "Chapter";

        // Write markdown beside the original file
        // Strip leading / from archive-absolute path for filesystem operations
        const fsRelativePath = chapter.path.slice(1);
        const mdPath = `${fsRelativePath}.dump.md`;
        await this.writeFile(mdPath, content);

        chapterList.push({
          index,
          title: title || "Chapter",
          path: chapter.path,
        });
      });

      // If only one item is requested, stop after dumping it
      if (only) break;
    }

    // Write chapter list to root
    await this.writeJSON("chapters.dump.json", chapterList);
  }
}
