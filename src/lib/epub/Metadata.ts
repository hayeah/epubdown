import { XMLParser } from "fast-xml-parser";
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

export interface DCProperty {
	name: string; // “title”, “creator”, “subject” …
	value: string; // text content
	attributes: Record<string, string>; // Raw XML attributes like "scheme", "file-as", etc.
	refinements: Map<string, string[]>; // “file-as” → [ "Melville, Herman" ]
}

export interface MetaProperty {
	property: string; // @property
	value: string; // text content
	id?: string; // optional @id
	refines?: string; // @refines (must start with “#”)
	scheme?: string; // @scheme, kept only if you need it
}

export class Metadata {
	private propertiesByName: Map<string, DCProperty[]> = new Map();
	private propertiesById: Map<string, DCProperty> = new Map();

	/* ---------- public API ------------------------------------------------ */

	addDC(
		name: string,
		value: string,
		attributes: Record<string, string> = {},
	): void {
		// Get ID from attributes if present
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
		this.propertiesByName.get(name)!.push(prop);

		if (id) {
			this.propertiesById.set(`#${id}`, prop);
		}
	}

	addMeta(meta: MetaProperty): void {
		if (!meta.refines) return; // only interested in refinements
		const target = this.propertiesById.get(meta.refines);
		if (!target) return; // unknown target → discard

		const key = meta.property.trim();
		if (!target.refinements.has(key)) {
			target.refinements.set(key, []);
		}
		target.refinements.get(key)!.push(meta.value);
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

	/* ---------- loaders --------------------------------------------------- */

	/** Convert the object returned by fast-xml-parser for the `<metadata>` node. */
	/** Build a `Metadata` instance from the plain object produced by Fast-XML-Parser. */
	static fromDom(dom: Record<string, unknown>): Metadata {
		const meta = new Metadata();

		// FxP returns either an object or an array for each tag
		const asArray = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);

		// --- 1st pass: add every dc:* element ---------------------------------
		for (const [tag, raw] of Object.entries(dom)) {
			if (!tag.startsWith("dc:")) continue;
			for (const elem of asArray<any>(raw)) {
				const name = tag.slice(3); // dc:title → title
				const value = Metadata.extractText(elem);

				// Extract attributes from the $ group
				const attrGroup = (elem?.$ ?? {}) as Record<string, string>;

				meta.addDC(name, value, attrGroup);
			}
		}

		// --- 2nd pass: attach refinements from <meta> -------------------------
		const metaNodes = dom.meta;
		if (metaNodes) {
			for (const elem of asArray<any>(metaNodes as any)) {
				// Extract attributes from the $ group
				const attrGroup = elem?.$ as Record<string, string> | undefined;
				if (!attrGroup) continue;

				const property = attrGroup.property;
				const refines = attrGroup.refines;
				if (!property) continue; // plain <meta>, ignore

				meta.addMeta({
					property,
					value: Metadata.extractText(elem),
					id: attrGroup.id,
					refines,
					scheme: attrGroup.scheme,
				});
			}
		}

		return meta;
	}

	/** Convenience helper: parse raw XML text and return `Metadata`. */
	static fromXml(xml: string): Metadata {
		const parser = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: "",
			attributesGroupName: "$",
			trimValues: false,
		});
		const obj = parser.parse(xml);

		if (!obj?.package?.metadata) {
			throw new Error("EPUB package metadata not found");
		}

		// fast-xml-parser: <metadata> may be wrapped in an array if multiple <metadata> tags exist
		const metaNode = Array.isArray(obj.package.metadata)
			? obj.package.metadata[0]
			: obj.package.metadata;

		return Metadata.fromDom(metaNode);
	}

	/* ---------- helpers --------------------------------------------------- */

	private static extractText(node: any): string {
		if (node == null) return "";
		if (typeof node === "string") return node;

		// With the new config, text content is directly in the node
		// We need to filter out the attributes ($) and other special properties
		if (typeof node === "object") {
			// If there's a #text property, use that (for backward compatibility)
			if ("#text" in node) return node["#text"];

			// If there's a __cdata property, use that
			if ("__cdata" in node) {
				const c = node.__cdata;
				return Array.isArray(c) ? c.join("") : c;
			}

			// Otherwise, look for a text property that's not $ or other special keys
			for (const [key, value] of Object.entries(node)) {
				if (key !== "$" && typeof value === "string") {
					return value;
				}
			}
		}

		return "";
	}
}
