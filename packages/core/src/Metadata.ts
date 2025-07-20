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

*/
import { parseXml } from "./xmlParser";

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

  /**
   * Gets the first value associated with the given key.
   * If there are no values associated with the key, returns "".
   * It is case insensitive; the key is normalized to lowercase.
   */
  get(key: string): string {
    const normalizedKey = this.normalizeKey(key);
    const props = this.propertiesByName.get(normalizedKey);
    return props?.[0]?.value || "";
  }

  /**
   * Returns all values associated with the given key.
   * It is case insensitive; the key is normalized to lowercase.
   */
  getValues(key: string): string[] {
    const normalizedKey = this.normalizeKey(key);
    const props = this.propertiesByName.get(normalizedKey);
    return props?.map((p) => p.value) || [];
  }

  private normalizeKey(key: string): string {
    // Remove dc: prefix if present and convert to lowercase
    return key.replace(/^dc:/i, "").toLowerCase();
  }

  addDC(
    name: string,
    value: string,
    attributes: Record<string, string> = {},
  ): void {
    const normalizedName = this.normalizeKey(name);
    const id = attributes.id;
    const prop: DCProperty = {
      name: normalizedName,
      value,
      attributes,
      refinements: new Map(),
    };

    if (!this.propertiesByName.has(normalizedName)) {
      this.propertiesByName.set(normalizedName, []);
    }
    this.propertiesByName.get(normalizedName)?.push(prop);

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
    return this.getProperties(name)[0]?.value;
  }

  getProperties(name: string): DCProperty[] {
    return this.propertiesByName.get(name) ?? [];
  }

  getById(id: string): DCProperty | undefined {
    return this.propertiesById.get(id.startsWith("#") ? id : `#${id}`);
  }

  /**
   * Returns a simple Record with the first value for each property.
   * Similar to http.Header in Go.
   */
  toJSON(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [name, props] of this.propertiesByName) {
      if (props.length > 0 && props[0]) {
        out[name] = props[0].value;
      }
    }
    return out;
  }

  /**
   * Returns the full structure with all values, attributes, and refinements.
   */
  toJSONFull(): Record<string, unknown> {
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

  /** Build a Metadata instance from a raw XML string. */
  static fromXml(xml: string): Metadata {
    const doc = parseXml(xml);

    // <package> is the root in an OPF file
    const pkg = doc.querySelector("package");
    if (!pkg) throw new Error("EPUB package element not found");

    // <metadata> is a direct child of <package>
    const metaNode = pkg.querySelector("metadata");
    if (!metaNode) throw new Error("EPUB package metadata not found");

    return Metadata.fromDom(metaNode);
  }

  /** Convert the `<metadata>` Element into a Metadata object. */
  static fromDom(metadataNode: Element): Metadata {
    const meta = new Metadata();

    for (const node of Array.from(metadataNode.children)) {
      // <dc:*>
      if (node.tagName.startsWith("dc:")) {
        const name = node.tagName.slice(3).toLowerCase(); // dc:title → title
        const value = node.textContent || "";

        // Collect attributes
        const attributes: Record<string, string> = {};
        for (const attr of Array.from(node.attributes)) {
          attributes[attr.name] = attr.value;
        }

        meta.addDC(name, value, attributes);
        continue;
      }

      // <meta>
      if (node.tagName.toLowerCase() === "meta") {
        const property = node.getAttribute("property");
        if (!property) continue; // ignore plain <meta>

        meta.addMeta({
          property,
          value: (node.textContent || "").trim(),
          id: node.getAttribute("id") || undefined,
          refines: node.getAttribute("refines") || undefined,
          scheme: node.getAttribute("scheme") || undefined,
        });
      }
    }

    return meta;
  }
}
