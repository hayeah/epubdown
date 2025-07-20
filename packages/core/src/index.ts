// Main EPub classes
export { EPub } from "./Epub";
export { XMLFile } from "./XMLFile";
export { Metadata } from "./Metadata";
export type {
  Metadata as MetadataType,
  DCProperty,
  MetaProperty,
} from "./Metadata";
export { TableOfContents } from "./TableOfContents";
export type { NavItem, FlatNavItem } from "./TableOfContents";

// Content conversion
export { ContentToMarkdown } from "./ContentToMarkdown";
export type { ConversionOptions } from "./ContentToMarkdown";

// XML parsing utilities
export { parseDocument } from "./xmlParser";
