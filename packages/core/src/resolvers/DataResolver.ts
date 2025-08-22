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

  async readXMLFile(href: string): Promise<any> {
    const { DOMFile } = await import("../DOMFile");
    // Handle absolute paths by using root resolver
    if (href.startsWith("/")) {
      // Create a root resolver (base = "") and use it
      const rootResolver = this.createInstance("");
      return DOMFile.load(href.slice(1), rootResolver);
    }
    // Handle relative paths normally
    return DOMFile.load(href, this);
  }

  abstract createInstance(base: string): DataResolver;
}
