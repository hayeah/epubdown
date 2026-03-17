import fs from "node:fs/promises";
import path from "node:path";
import { EPub } from "../Epub";

export class EpubExporter {
  private tocLabelMap?: Map<string, string>;

  constructor(
    private readonly epub: EPub,
    private readonly outdir: string,
  ) {}

  static async fromZipFile(
    epubFile: string,
    outdir?: string,
  ): Promise<EpubExporter> {
    const resolvedPath = path.resolve(epubFile);
    const effectiveOutdir =
      outdir ||
      path.join(
        path.dirname(resolvedPath),
        `${path.basename(resolvedPath)}.export`,
      );

    const zipData = await fs.readFile(resolvedPath);
    const epub = await EPub.fromZip(zipData);
    return new EpubExporter(epub, effectiveOutdir);
  }

  async export(): Promise<void> {
    await fs.mkdir(this.outdir, { recursive: true });

    // Build ToC label map for chapter titles
    this.tocLabelMap = await this.buildTOCLabelMap();

    const chapters: Array<{
      index: number;
      filename: string;
      label: string;
    }> = [];

    let index = 0;
    for await (const chapter of this.epub.chapters(false)) {
      index += 1;
      const prefix = String(index).padStart(3, "0");

      // Convert chapter to markdown
      let markdown = await this.epub.chapterMarkdown(chapter.path);

      // Get label from ToC, fall back to first heading, then "chapter"
      const tocLabel = this.tocLabelMap.get(chapter.path);
      const titleMatch = markdown.match(/^#\s+(.+)$/m);
      const label = tocLabel || titleMatch?.[1] || "chapter";

      const safeName = this.slug(label);
      const filename = `${prefix}-${safeName}.md`;

      // Extract and rewrite images
      markdown = await this.processImages(markdown, prefix);

      // Write chapter markdown
      await fs.writeFile(path.join(this.outdir, filename), markdown, "utf8");
      console.log(`  ${filename}`);

      chapters.push({ index, filename, label });
    }

    // Generate outline
    const outline = this.generateOutline(chapters);
    await fs.writeFile(
      path.join(this.outdir, "000-outline.md"),
      outline,
      "utf8",
    );
    console.log("  000-outline.md");

    console.log(`\nExported ${chapters.length} chapters to ${this.outdir}`);
  }

  private async buildTOCLabelMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const flatItems = await this.epub.toc.flatNavItems();

    for (const item of flatItems) {
      // Strip fragment from path
      const basePath = item.path.split("#")[0] ?? item.path;
      // Use first matching label for each path
      if (!map.has(basePath)) {
        map.set(basePath, item.label);
      }
    }

    return map;
  }

  private async processImages(
    markdown: string,
    prefix: string,
  ): Promise<string> {
    // Match markdown images with absolute archive paths
    const imageRegex = /!\[([^\]]*)\]\((\/[^)]+)\)/g;
    const imageExts = new Set([
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".webp",
      ".avif",
      ".bmp",
      ".tiff",
      ".tif",
    ]);

    const replacements: Array<{ original: string; replacement: string }> = [];
    const usedNames = new Set<string>();

    for (const match of markdown.matchAll(imageRegex)) {
      const fullMatch = match[0];
      const alt = match[1] ?? "";
      const absPath = match[2];
      if (!absPath) continue;

      const ext = path.extname(absPath).toLowerCase();
      if (!imageExts.has(ext)) continue;

      // Determine unique output filename
      let basename = path.basename(absPath);
      if (usedNames.has(basename)) {
        const nameWithoutExt = path.basename(absPath, ext);
        let counter = 2;
        while (usedNames.has(`${nameWithoutExt}-${counter}${ext}`)) {
          counter++;
        }
        basename = `${nameWithoutExt}-${counter}${ext}`;
      }
      usedNames.add(basename);

      // Read image from epub
      const imageData = await this.epub.resolver.readRaw(absPath);
      if (!imageData) {
        console.warn(`  Warning: image not found in EPUB: ${absPath}`);
        continue;
      }

      // Write image to prefix/ directory
      const imageDir = path.join(this.outdir, prefix);
      await fs.mkdir(imageDir, { recursive: true });
      await fs.writeFile(path.join(imageDir, basename), imageData);

      const relativePath = `${prefix}/${basename}`;
      replacements.push({
        original: fullMatch,
        replacement: `![${alt}](${relativePath})`,
      });
    }

    // Apply replacements
    let result = markdown;
    for (const { original, replacement } of replacements) {
      result = result.replace(original, replacement);
    }

    return result;
  }

  private generateOutline(
    chapters: Array<{ index: number; filename: string; label: string }>,
  ): string {
    const lines = ["# Outline", ""];
    for (const ch of chapters) {
      lines.push(`- [${ch.label}](${ch.filename})`);
    }
    lines.push("");
    return lines.join("\n");
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
}
