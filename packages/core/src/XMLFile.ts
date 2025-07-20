import { basename, dirname, join } from "node:path";
import { DataResolver } from "./resolvers/DataResolver";
import { parseXml } from "./xmlParser";

export class XMLFile extends DataResolver {
  constructor(
    public readonly base: string,
    public readonly name: string,
    public readonly content: string,
    public readonly dom: XMLDocument,
    public readonly resolver: DataResolver,
  ) {
    super(base);
  }

  get path() {
    return join(this.base, this.name);
  }

  static async load(
    href: string,
    resolver: DataResolver,
  ): Promise<XMLFile | undefined> {
    const content = await resolver.read(href);
    if (!content) {
      return undefined;
    }

    const dom = parseXml(content) as XMLDocument;
    const newBase = join(resolver.base, dirname(href));
    const name = basename(href);

    return new XMLFile(newBase, name, content, dom, resolver.rebase(newBase));
  }

  async readRaw(href: string): Promise<Uint8Array | undefined> {
    return this.resolver.readRaw(href);
  }

  async read(href: string): Promise<string | undefined> {
    return this.resolver.read(href);
  }

  createInstance(base: string): DataResolver {
    // throw new Error("Not implemented");
    return this.resolver.createInstance(base);
  }

  querySelector(selector: string): Element | null {
    return this.dom.querySelector(selector);
  }

  querySelectorAll(selector: string): NodeListOf<Element> {
    return this.dom.querySelectorAll(selector);
  }
}
