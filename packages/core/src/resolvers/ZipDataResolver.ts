import type JSZip from "jszip";
import { DataResolver } from "./DataResolver";

export class ZipDataResolver extends DataResolver {
  constructor(private readonly zip: JSZip) {
    super();
  }

  async readRaw(absPath: string): Promise<Uint8Array | undefined> {
    if (!absPath.startsWith("/")) {
      throw new Error(`Absolute path required, got: ${absPath}`);
    }

    // Remove leading / for zip file access
    const zipPath = absPath.slice(1);
    const file = this.zip.file(zipPath);
    if (!file) return undefined;
    return await file.async("uint8array");
  }
}
