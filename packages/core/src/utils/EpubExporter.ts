import fs from "node:fs/promises";
import path from "node:path";
import type { DOMFile } from "../DOMFile";
import { EPub } from "../Epub";
import { normalizePath } from "./normalizePath";

interface ImageRef {
  /** Absolute archive path (e.g. /OEBPS/images/foo.png) */
  archivePath: string;
  /** Alt text from the img tag */
  alt: string;
}

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

    this.tocLabelMap = await this.buildTOCLabelMap();

    const chapters: Array<{
      index: number;
      filename: string;
      label: string;
      inTOC: boolean;
    }> = [];

    let index = 0;
    for await (const chapter of this.epub.chapters(false)) {
      index += 1;
      const prefix = String(index).padStart(3, "0");

      // Extract image refs from DOM before markdown conversion (Turndown may drop them)
      const imageRefs = this.extractImageRefs(chapter);

      // Convert chapter to markdown
      let markdown = await this.epub.chapterMarkdown(chapter.path);

      // Get label from ToC, fall back to first heading
      const tocLabel = this.tocLabelMap.get(chapter.path);
      const titleMatch = markdown.match(/^#\s+(.+)$/m);
      const label = tocLabel || titleMatch?.[1];

      const slugged = label ? this.slug(label) : "";
      const filename = slugged ? `${prefix}-${slugged}.md` : `${prefix}.md`;

      // Save images and build path mapping
      const pathMap = await this.saveImages(imageRefs, prefix);

      // Rewrite any absolute image paths that made it into the markdown
      markdown = this.rewriteImagePaths(markdown, pathMap);

      // Append images that Turndown dropped (not found in markdown)
      markdown = this.appendMissingImages(markdown, imageRefs, pathMap);

      await fs.writeFile(path.join(this.outdir, filename), markdown, "utf8");
      console.log(
        `  ${filename}${pathMap.size > 0 ? ` (${pathMap.size} images)` : ""}`,
      );

      chapters.push({
        index,
        filename,
        label: label || filename,
        inTOC: tocLabel !== undefined,
      });
    }

    const outline = this.generateOutline(chapters);
    await fs.writeFile(
      path.join(this.outdir, "000-outline.md"),
      outline,
      "utf8",
    );
    console.log("  000-outline.md");

    const bookJSON = this.generateBookJSON(chapters);
    await fs.writeFile(
      path.join(this.outdir, "book.json"),
      JSON.stringify(bookJSON, null, 2) + "\n",
      "utf8",
    );
    console.log("  book.json");

    console.log(`\nExported ${chapters.length} chapters to ${this.outdir}`);
  }

  /** Extract image references from chapter DOM, resolving relative paths to absolute */
  private extractImageRefs(chapter: DOMFile): ImageRef[] {
    const refs: ImageRef[] = [];
    const seen = new Set<string>();

    // Regular img tags
    const imgs = chapter.dom.querySelectorAll("img[src]");
    for (const img of imgs) {
      const src = img.getAttribute("src");
      if (!src) continue;
      const archivePath = this.resolveImagePath(chapter.base, src);
      if (!archivePath || seen.has(archivePath)) continue;
      seen.add(archivePath);
      refs.push({ archivePath, alt: img.getAttribute("alt") || "" });
    }

    // SVG image elements (xlink:href or href)
    const svgImages = chapter.dom.querySelectorAll("image");
    for (const img of svgImages) {
      const href =
        img.getAttribute("xlink:href") ||
        img.getAttribute("href") ||
        img.getAttributeNS("http://www.w3.org/1999/xlink", "href");
      if (!href) continue;
      const archivePath = this.resolveImagePath(chapter.base, href);
      if (!archivePath || seen.has(archivePath)) continue;
      seen.add(archivePath);
      refs.push({ archivePath, alt: "" });
    }

    return refs;
  }

  /** Resolve a potentially relative image src to an absolute archive path */
  private resolveImagePath(base: string, src: string): string | null {
    if (/^(https?:|data:|blob:)/i.test(src)) return null;
    if (src.startsWith("/")) return src;
    return normalizePath(base, src);
  }

  /** Save images to the NNN/ directory and return a mapping of archive path -> relative path */
  private async saveImages(
    imageRefs: ImageRef[],
    prefix: string,
  ): Promise<Map<string, string>> {
    const pathMap = new Map<string, string>();
    const usedNames = new Set<string>();

    for (const ref of imageRefs) {
      const imageData = await this.epub.resolver.readRaw(ref.archivePath);
      if (!imageData) {
        console.warn(`  Warning: image not found in EPUB: ${ref.archivePath}`);
        continue;
      }

      const ext = path.extname(ref.archivePath).toLowerCase();
      let basename = path.basename(ref.archivePath);

      // Deduplicate filenames
      if (usedNames.has(basename)) {
        const nameWithoutExt = path.basename(ref.archivePath, ext);
        let counter = 2;
        while (usedNames.has(`${nameWithoutExt}-${counter}${ext}`)) {
          counter++;
        }
        basename = `${nameWithoutExt}-${counter}${ext}`;
      }
      usedNames.add(basename);

      const imageDir = path.join(this.outdir, prefix);
      await fs.mkdir(imageDir, { recursive: true });
      await fs.writeFile(path.join(imageDir, basename), imageData);

      pathMap.set(ref.archivePath, `${prefix}/${basename}`);
    }

    return pathMap;
  }

  /** Rewrite absolute archive image paths in markdown to relative paths */
  private rewriteImagePaths(
    markdown: string,
    pathMap: Map<string, string>,
  ): string {
    if (pathMap.size === 0) return markdown;

    // Match markdown images with absolute archive paths
    return markdown.replace(
      /!\[([^\]]*)\]\((\/[^)]+)\)/g,
      (match, alt: string, absPath: string) => {
        const relativePath = pathMap.get(absPath);
        if (relativePath) return `![${alt}](${relativePath})`;
        return match;
      },
    );
  }

  /** Append markdown image references for images that Turndown dropped */
  private appendMissingImages(
    markdown: string,
    imageRefs: ImageRef[],
    pathMap: Map<string, string>,
  ): string {
    const missingImages: string[] = [];

    for (const ref of imageRefs) {
      const relativePath = pathMap.get(ref.archivePath);
      if (!relativePath) continue;

      // Check if this image already appears in the markdown
      if (
        markdown.includes(relativePath) ||
        markdown.includes(ref.archivePath)
      ) {
        continue;
      }

      missingImages.push(`![${ref.alt}](${relativePath})`);
    }

    if (missingImages.length === 0) return markdown;

    return `${markdown.trimEnd()}\n\n${missingImages.join("\n\n")}\n`;
  }

  private async buildTOCLabelMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const flatItems = await this.epub.toc.flatNavItems();

    for (const item of flatItems) {
      const basePath = item.path.split("#")[0] ?? item.path;
      if (!map.has(basePath)) {
        map.set(basePath, item.label);
      }
    }

    return map;
  }

  private generateBookJSON(
    chapters: Array<{
      index: number;
      filename: string;
      label: string;
      inTOC: boolean;
    }>,
  ): Record<string, unknown> {
    const meta = this.epub.metadata.toJSON();

    const outlineEntries = chapters
      .filter((ch) => ch.inTOC)
      .map((ch) => ({ filename: ch.filename, title: ch.label }));

    const chapterEntries = chapters.map((ch) => {
      const entry: { filename: string; title?: string } = {
        filename: ch.filename,
      };
      // Only include title if the chapter has a meaningful label (not just the filename)
      if (ch.label !== ch.filename) {
        entry.title = ch.label;
      }
      return entry;
    });

    return {
      ...meta,
      outline: outlineEntries,
      chapters: chapterEntries,
    };
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
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50);
  }
}
