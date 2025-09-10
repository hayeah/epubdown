import { join } from "node:path";
import { DataResolver } from "./DataResolver";

/**
 * Filesystem variant of DataResolver
 * Reads files from an extracted EPUB directory on the filesystem
 */
export class FileDataResolver extends DataResolver {
  constructor(private readonly filesystemRoot: string) {
    super();
  }

  async readRaw(absPath: string): Promise<Uint8Array | undefined> {
    try {
      if (!absPath.startsWith("/")) {
        throw new Error(`Absolute path required, got: ${absPath}`);
      }

      const fs = await import("node:fs/promises");

      // Convert archive path to filesystem path
      // Remove leading / and join with filesystem root
      const fullPath = join(this.filesystemRoot, absPath.slice(1));

      const data = await fs.readFile(fullPath);
      return new Uint8Array(data);
    } catch (error) {
      return undefined;
    }
  }
}
