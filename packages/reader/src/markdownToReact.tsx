import parse, { type DOMNode, Element, domToReact } from "html-react-parser";
import { marked } from "marked";
import React from "react";
import { Footnote, Image, InternalLink } from "./MarkdownComponents";

export async function markdownToReact(
  markdown: string,
): Promise<React.ReactNode> {
  // Convert markdown to HTML using marked
  const html = await marked.parse(markdown, {
    mangle: false,
    headerIds: false,
  });

  // Parse HTML to React components
  return parse(html, {
    // TRANSFORM vs REPLACE:
    // - replace: Pre-order hook - runs BEFORE node is converted to React
    //   Returns React element to stop traversal, or undefined to continue
    //   Use for: custom components, skipping subtrees
    // - transform: Post-order hook - runs AFTER node is converted to React
    //   Children already processed. Can return element/string/null
    //   Use for: wrapping processed nodes, modifying final output

    // We use replace for x-image/x-footnote to handle as atomic units
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
    // We use transform for <a> tags because:
    // 1. Children are already processed (e.g., nested x-image → Image component)
    // 2. We need the processed children to wrap in InternalLink
    // 3. If we used replace, we'd have to manually handle all child elements
    //
    // Example flow: <a href="#ch1"><x-image src="icon.png"></x-image></a>
    // 1. Parser encounters <a>, descends into children
    // 2. replace converts <x-image> to <Image> component
    // 3. Parser ascends back to <a>
    // 4. transform receives <a> as React element with <Image> child
    // 5. We wrap it in InternalLink with already-processed child
    transform(reactNode, domNode, index) {
      if (
        domNode.type === "tag" &&
        domNode instanceof Element &&
        domNode.name === "a" &&
        React.isValidElement(reactNode)
      ) {
        const { href, class: className } = domNode.attribs;
        // Cast is safe because we've checked React.isValidElement
        const element = reactNode as React.ReactElement<{
          children: React.ReactNode;
        }>;
        return (
          <InternalLink href={href || ""} className={className}>
            {element.props.children}
          </InternalLink>
        );
      }
      // Transform expects specific return types - filter out incompatible types
      if (
        typeof reactNode === "string" ||
        React.isValidElement(reactNode) ||
        reactNode === null
      ) {
        return reactNode;
      }
      // For other types (number, boolean, etc), return void to use default processing
      return;
    },
  });
}
