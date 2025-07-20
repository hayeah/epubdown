import { resolve } from "node:path";
import { DataResolver } from "./DataResolver";

/**
 * Filesystem variant of DataResolver, used by EPubShortener
 */
export class FileDataResolver extends DataResolver {
  constructor(base = "") {
    super(base);
  }

  async read(href: string): Promise<string | undefined> {
    try {
      const fs = await import("node:fs/promises");
      const fullPath = resolve(this.base, href);
      return await fs.readFile(fullPath, "utf-8");
    } catch (error) {
      return undefined;
    }
  }

  async readRaw(href: string): Promise<Uint8Array | undefined> {
    const fs = await import("node:fs/promises");
    const fullPath = resolve(this.base, href);
    const data = await fs.readFile(fullPath);
    return data;
  }

  createInstance(base: string): DataResolver {
    return new FileDataResolver(base);
  }
}
