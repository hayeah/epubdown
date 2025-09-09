import { type ContentType, DOMFile } from "../DOMFile";
import { normalizePath } from "../utils/normalizePath";

export abstract class DataResolver {
  constructor(public readonly base: string = "") {}

  /**
   * Read a file as a UTF-8 string
   * Implemented using readRaw with UTF-8 decoding
   */
  async read(href: string): Promise<string | undefined> {
    const data = await this.readRaw(href);
    if (!data) return undefined;

    // Convert Uint8Array to string using TextDecoder
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(data);
  }

  /**
   * Read a file as raw bytes - must be implemented by subclasses
   */
  abstract readRaw(href: string): Promise<Uint8Array | undefined>;

  /**
   * Resolve an href to an absolute path
   * If href starts with /, returns it as-is
   * Otherwise normalizes it relative to the current base
   * Always returns an absolute path starting with /
   */
  protected resolveHref(href: string): string {
    if (href.startsWith("/")) {
      // Already absolute
      return href;
    }
    // Relative path - normalize relative to base
    return normalizePath(this.base, href);
  }

  // Can be implemented in base class since it just creates new instance
  rebase(base: string): DataResolver {
    return this.createInstance(base);
  }

  /**
   * Read a file and parse as a DOMFile with an explicit content type
   */
  async readDOMFile(
    href: string,
    contentType?: string,
  ): Promise<any> {
    if (href.startsWith("/")) {
      const rootResolver = this.createInstance("");
      return DOMFile.load(href.slice(1), rootResolver, contentType);
    }
    return DOMFile.load(href, this, contentType);
  }

  abstract createInstance(base: string): DataResolver;
}
