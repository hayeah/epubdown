import type JSZip from "jszip";
import { DataResolver } from "./DataResolver";

export class ZipDataResolver extends DataResolver {
  constructor(
    private readonly zip: JSZip,
    base = "",
  ) {
    super(base);
  }

  async readRaw(href: string): Promise<Uint8Array | undefined> {
    const absolutePath = this.resolveHref(href);
    // Remove leading / for zip file access
    const zipPath = absolutePath.slice(1);
    const file = this.zip.file(zipPath);
    if (!file) return undefined;
    return await file.async("uint8array");
  }

  createInstance(base: string): DataResolver {
    return new ZipDataResolver(this.zip, base);
  }
}
