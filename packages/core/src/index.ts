// Main EPub classes
export { EPub, XMLFile, FileDataResolver } from "./Epub";
export { EPubMarkdownConverter } from "./EPubMarkdownConverter";
export { Metadata } from "./Metadata";
export type {
  Metadata as MetadataType,
  DCProperty,
  MetaProperty,
} from "./Metadata";

// Content conversion
export { ContentToMarkdown } from "./ContentToMarkdown";
export type { ConversionOptions } from "./ContentToMarkdown";

// XML parsing utilities
export { parseDocument } from "./xmlParser";
