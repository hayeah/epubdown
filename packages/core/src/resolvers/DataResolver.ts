import { type ContentType, DOMFile } from "../DOMFile";

export abstract class DataResolver {
  /**
   * Read a file as a UTF-8 string
   * @param absPath Absolute path from EPUB root (must start with /)
   */
  async read(absPath: string): Promise<string | undefined> {
    this.assertAbsolute(absPath);
    const data = await this.readRaw(absPath);
    if (!data) return undefined;

    // Convert Uint8Array to string using TextDecoder
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(data);
  }

  /**
   * Read a file as raw bytes - must be implemented by subclasses
   * @param absPath Absolute path from EPUB root (must start with /)
   */
  abstract readRaw(absPath: string): Promise<Uint8Array | undefined>;

  /**
   * Read a file and parse as a DOMFile with an explicit content type
   * @param absPath Absolute path from EPUB root (must start with /)
   * @param contentType Optional explicit content type
   */
  async readDOMFile(
    absPath: string,
    contentType?: string,
  ): Promise<DOMFile | undefined> {
    this.assertAbsolute(absPath);
    return DOMFile.load(absPath, this, contentType);
  }

  /**
   * Assert that a path is absolute
   * @throws Error if path is not absolute
   */
  protected assertAbsolute(path: string): void {
    if (!path.startsWith("/")) {
      throw new Error(`Expected absolute path from EPUB root, got: ${path}`);
    }
  }
}
