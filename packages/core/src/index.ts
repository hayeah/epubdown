// Main EPub classes
export { EPub } from "./Epub";
export { XMLFile } from "./XMLFile";
export { FileDataResolver } from "./resolvers/FileDataResolver";
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
