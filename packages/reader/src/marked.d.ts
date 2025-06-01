declare module "marked" {
  export interface MarkedOptions {
    breaks?: boolean;
    gfm?: boolean;
    headerIds?: boolean;
    mangle?: boolean;
    pedantic?: boolean;
    sanitize?: boolean;
    silent?: boolean;
    smartLists?: boolean;
    smartypants?: boolean;
    xhtml?: boolean;
  }

  export interface Marked {
    (markdown: string, options?: MarkedOptions): string;
    parse: (markdown: string, options?: MarkedOptions) => string;
    parseInline: (markdown: string, options?: MarkedOptions) => string;
  }

  export const marked: Marked;
}
