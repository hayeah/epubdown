import parse, { type DOMNode, Element, domToReact } from "html-react-parser";
import { marked } from "marked";
import React from "react";
import { Footnote, Image, InternalLink } from "./MarkdownComponents";
import { CollectionImage } from "./markdown/CollectionImage";
import type { CollectionReaderStore } from "./stores/CollectionReaderStore";
import { highlightCode } from "./utils/codeHighlighter";

// Store for highlighted code blocks during async processing
const codeBlockStore = new Map<string, string>();

export interface MarkdownContext {
  type: "collection";
  readerStore: CollectionReaderStore;
}

export async function markdownToReact(
  markdown: string,
  context?: MarkdownContext,
): Promise<React.ReactNode> {
  // Clear previous code blocks
  codeBlockStore.clear();

  // First pass: collect all code blocks and highlight them
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const codeBlocks: Array<{ lang: string; code: string; placeholder: string }> =
    [];

  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const lang = match[1] || "text";
    const code = match[2] ?? "";
    const placeholder = `__CODE_BLOCK_${index}__`;
    codeBlocks.push({
      lang,
      code: code.trimEnd(),
      placeholder,
    });
    index++;
  }

  // Highlight all code blocks in parallel
  const highlightedBlocks = await Promise.all(
    codeBlocks.map(async (block) => ({
      placeholder: block.placeholder,
      html: await highlightCode(block.code, block.lang),
    })),
  );

  // Store highlighted HTML
  for (const block of highlightedBlocks) {
    codeBlockStore.set(block.placeholder, block.html);
  }

  // Replace code blocks with placeholders
  let processedMarkdown = markdown;
  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i];
    if (block) {
      processedMarkdown = processedMarkdown.replace(
        new RegExp(
          "```" + block.lang + "\\n" + escapeRegex(block.code) + "```",
        ),
        block.placeholder,
      );
    }
  }

  // Convert markdown to HTML using marked
  const html = await marked.parse(processedMarkdown);

  // Replace placeholders with highlighted HTML
  let finalHtml = html;
  for (const [placeholder, highlightedHtml] of codeBlockStore) {
    finalHtml = finalHtml.replace(
      new RegExp(`<p>${placeholder}</p>|${placeholder}`, "g"),
      highlightedHtml,
    );
  }

  // Parse HTML to React components
  return parse(finalHtml, {
    // TRANSFORM vs REPLACE:
    // - replace: Pre-order hook - runs BEFORE node is converted to React
    //   Returns React element to stop traversal, or undefined to continue
    //   Use for: custom components, skipping subtrees
    // - transform: Post-order hook - runs AFTER node is converted to React
    //   Children already processed. Can return element/string/null
    //   Use for: wrapping processed nodes, modifying final output

    replace(domNode) {
      if (domNode.type === "tag" && domNode instanceof Element) {
        const tag = domNode.name;

        // Handle headings - add id for anchor navigation
        if (/^h[1-6]$/.test(tag)) {
          const text = getTextContent(domNode);
          const id = slugify(text);
          const children = domToReact(domNode.children as DOMNode[]);
          return React.createElement(tag, { id }, children);
        }

        // Handle native img tags
        if (tag === "img") {
          const {
            src,
            alt,
            title,
            width,
            height,
            class: className,
          } = domNode.attribs;

          // Use CollectionImage for collection context
          if (context?.type === "collection") {
            return (
              <CollectionImage
                src={src || ""}
                alt={alt}
                title={title}
                width={width ? Number.parseInt(width) : undefined}
                height={height ? Number.parseInt(height) : undefined}
                className={className}
                readerStore={context.readerStore}
              />
            );
          }

          // Use EPUB Image for book context (default)
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

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Generate a URL-safe slug from text
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * Extract text content from a DOM node recursively
 */
function getTextContent(node: Element): string {
  let text = "";
  for (const child of node.children) {
    if (child.type === "text") {
      text += (child as unknown as { data: string }).data;
    } else if (child.type === "tag" && child instanceof Element) {
      text += getTextContent(child);
    }
  }
  return text;
}
