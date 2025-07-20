import { join } from "node:path";
import type JSZip from "jszip";
import { DataResolver } from "./DataResolver";

export class ZipDataResolver extends DataResolver {
  constructor(
    private readonly zip: JSZip,
    base = "",
  ) {
    super(base);
  }

  async read(href: string): Promise<string | undefined> {
    const fullPath = this.base ? join(this.base, href) : href;
    const file = this.zip.file(fullPath);
    if (!file) return undefined;
    return await file.async("string");
  }

  async readRaw(href: string): Promise<Uint8Array | undefined> {
    const fullPath = this.base ? join(this.base, href) : href;
    const file = this.zip.file(fullPath);
    if (!file) return undefined;
    return await file.async("uint8array");
  }

  createInstance(base: string): DataResolver {
    return new ZipDataResolver(this.zip, base);
  }
}
