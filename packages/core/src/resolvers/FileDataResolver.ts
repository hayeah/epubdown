import { join } from "node:path";
import { DataResolver } from "./DataResolver";

/**
 * Filesystem variant of DataResolver, used by EPubShortener
 *
 * The FileDataResolver has two concepts:
 * - filesystemRoot: The actual filesystem path where the EPUB is extracted
 * - base: The current archive-relative base path for resolving relative paths
 *
 * When first created, both are the same (the EPUB root directory).
 * When rebased, only the archive base changes, not the filesystem root.
 */
export class FileDataResolver extends DataResolver {
  private readonly filesystemRoot: string;

  constructor(filesystemPath: string, base = "") {
    super(base);
    this.filesystemRoot = filesystemPath;
  }

  async readRaw(href: string): Promise<Uint8Array | undefined> {
    try {
      const fs = await import("node:fs/promises");

      // Resolve the href to an absolute archive path
      const absolutePath = this.resolveHref(href);

      // Convert archive path to filesystem path
      // Remove leading / and join with filesystem root
      const fullPath = join(this.filesystemRoot, absolutePath.slice(1));

      const data = await fs.readFile(fullPath);
      return new Uint8Array(data);
    } catch (error) {
      return undefined;
    }
  }

  createInstance(base: string): DataResolver {
    // Keep the same filesystem root but change the archive base
    return new FileDataResolver(this.filesystemRoot, base);
  }
}
