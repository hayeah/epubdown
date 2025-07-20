export abstract class DataResolver {
  constructor(public readonly base: string = "") {}

  abstract read(href: string): Promise<string | undefined>;
  abstract readRaw(href: string): Promise<Uint8Array | undefined>;

  // Can be implemented in base class since it just creates new instance
  rebase(base: string): DataResolver {
    return this.createInstance(base);
  }

  async readXMLFile(href: string): Promise<any> {
    const { XMLFile } = await import("../XMLFile");
    return XMLFile.load(href, this);
  }

  abstract createInstance(base: string): DataResolver;
}
