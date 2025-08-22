// Main EPub classes
export { EPub } from "./Epub";
export type { ManifestItem } from "./Epub";
export { DOMFile } from "./DOMFile";
export type { ContentType } from "./DOMFile";
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

// Path utilities
export { normalizePath } from "./utils/normalizePath";
