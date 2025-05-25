/*

  A small, JSON-friendly wrapper around EPUB3 `<metadata>`.

  • `propertiesByName`  – map from property name (title, creator…) to one or more DCProperty objects  
  • `propertiesById`    – map from fragment IDs (#title, #author…) to the same DCProperty objects

  Parsing strategy

  • Every `<dc:* id="…">value</dc:*>` becomes one DCProperty.
  • Every `<meta property="x" refines="#id">value</meta>` turns into a refinement on
    the DCProperty whose id is that fragment. Meta elements without `refines`
    (or with an unknown target) are ignored.
  • Non-`dc:*` elements (link, meta without refines, etc.) are skipped intentionally;
    add support as needed.

  Fast-XML-Parser settings

  The `fromDom()` helper expects you parsed the XML with:
    new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: false })

*/
import { parse, stringify } from "./txml.js";

export interface DCProperty {
  name: string;
  value: string;
  attributes: Record<string, string>;
  refinements: Map<string, string[]>;
}

export interface MetaProperty {
  property: string;
  value: string;
  id?: string;
  refines?: string;
  scheme?: string;
}

export class Metadata {
  private propertiesByName: Map<string, DCProperty[]> = new Map();
  private propertiesById: Map<string, DCProperty> = new Map();

  /* ---------- public API ---------- */

  addDC(
    name: string,
    value: string,
    attributes: Record<string, string> = {},
  ): void {
    const id = attributes.id;
    const prop: DCProperty = {
      name,
      value,
      attributes,
      refinements: new Map(),
    };

    if (!this.propertiesByName.has(name)) {
      this.propertiesByName.set(name, []);
    }
    this.propertiesByName.get(name)?.push(prop);

    if (id) this.propertiesById.set(`#${id}`, prop);
  }

  addMeta(meta: MetaProperty): void {
    if (!meta.refines) return;
    const target = this.propertiesById.get(meta.refines);
    if (!target) return;

    const key = meta.property.trim();
    if (!target.refinements.has(key)) {
      target.refinements.set(key, []);
    }
    target.refinements.get(key)?.push(meta.value);
  }

  getText(name: string): string | undefined {
    return this.get(name)[0]?.value;
  }

  get(name: string): DCProperty[] {
    return this.propertiesByName.get(name) ?? [];
  }

  getById(id: string): DCProperty | undefined {
    return this.propertiesById.get(id.startsWith("#") ? id : `#${id}`);
  }

  toJSON(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [name, props] of this.propertiesByName) {
      out[name] = props.map((p) => ({
        value: p.value,
        attributes: p.attributes,
        refinements: Object.fromEntries(p.refinements),
      }));
    }
    return out;
  }

  /* ---------- loaders ---------- */

  /** Build a Metadata instance from a raw XML string via tXml. */
  static fromXml(xml: string): Metadata {
    // Parse with “pure XML” settings (no automatic void elements)
    const dom = parse(xml, { noChildNodes: [] }) as any[];

    // <package> is the root in an OPF file
    const pkg = dom.find((n) => n.tagName === "package");
    if (!pkg) throw new Error("EPUB package element not found");

    // <metadata> is a direct child of <package>
    const metaNode = (pkg.children as any[]).find(
      (n) => typeof n === "object" && n.tagName === "metadata",
    );
    if (!metaNode) throw new Error("EPUB package metadata not found");

    return Metadata.fromDom(metaNode);
  }

  /** Convert the tXml `<metadata>` node into a Metadata object. */
  static fromDom(metadataNode: any): Metadata {
    const meta = new Metadata();

    for (const node of metadataNode.children as any[]) {
      if (typeof node !== "object") continue; // skip raw text

      // <dc:*>
      if (node.tagName?.startsWith("dc:")) {
        const name = node.tagName.slice(3); // dc:title → title
        const value = Metadata.extractText(node);
        meta.addDC(name, value, node.attributes ?? {});
        continue;
      }

      // <meta>
      if (node.tagName === "meta") {
        const attrs = node.attributes ?? {};
        if (!attrs.property) continue; // ignore plain <meta>

        meta.addMeta({
          property: attrs.property,
          value: Metadata.extractText(node),
          id: attrs.id,
          refines: attrs.refines,
          scheme: attrs.scheme,
        });
      }
    }

    return meta;
  }

  /* ---------- helpers ---------- */

  private static extractText(node: any): string {
    return stringify(node.children);
  }
}
