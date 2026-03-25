import parse, { type DOMNode, Element, domToReact } from "html-react-parser";
import { marked } from "marked";
import React from "react";
import { Footnote } from "./Footnote";
import { Image } from "./Image";
import { InternalLink } from "./InternalLink";

export async function markdownToReact(markdown: string): Promise<React.ReactNode> {
  const html = await marked.parse(markdown);

  return parse(html, {
    replace(domNode) {
      if (domNode.type === "tag" && domNode instanceof Element) {
        const tag = domNode.name;

        if (tag === "img") {
          const { src, alt, title, width, height, class: className } = domNode.attribs;
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
    transform(reactNode, domNode) {
      if (
        domNode.type === "tag" &&
        domNode instanceof Element &&
        domNode.name === "a" &&
        React.isValidElement(reactNode)
      ) {
        const { href, class: className } = domNode.attribs;
        const element = reactNode as React.ReactElement<{ children: React.ReactNode }>;
        return (
          <InternalLink href={href || ""} className={className}>
            {element.props.children}
          </InternalLink>
        );
      }
      if (typeof reactNode === "string" || React.isValidElement(reactNode) || reactNode === null) {
        return reactNode;
      }
      return;
    },
  });
}
