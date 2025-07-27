import parse, { type DOMNode, Element, domToReact } from "html-react-parser";
import { marked } from "marked";
import type React from "react";
import { Footnote, Image } from "./MarkdownComponents";

export async function markdownToReact(
  markdown: string,
): Promise<React.ReactNode> {
  // Convert markdown to HTML using marked
  const html = await marked.parse(markdown);

  // Parse HTML to React components
  return parse(html, {
    replace(domNode) {
      if (domNode.type === "tag" && domNode instanceof Element) {
        const tag = domNode.name;

        if (tag === "x-image") {
          const {
            src,
            alt,
            title,
            width,
            height,
            class: className,
          } = domNode.attribs;

          // IMPORTANT: x-image tags must use explicit closing tags <x-image></x-image>
          // html-react-parser doesn't recognize custom tags as void elements
          // and will incorrectly parse self-closing tags, treating subsequent
          // content as children
          return (
            <Image
              src={src || ""}
              alt={alt}
              title={title}
              width={width ? Number.parseInt(width) : undefined}
              height={height ? Number.parseInt(height) : undefined}
              className={className}
            />
          );
        }

        if (tag === "x-footnote") {
          const { href, id, class: className } = domNode.attribs;
          const children = domToReact(domNode.children as DOMNode[]);
          return (
            <Footnote href={href || ""} id={id} className={className}>
              {children}
            </Footnote>
          );
        }
      }
    },
  });
}
