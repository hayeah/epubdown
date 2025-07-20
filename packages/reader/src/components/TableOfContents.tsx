import type { EPub, XMLFile } from "@epubdown/core";
import parse, { type Element, type DOMNode } from "html-react-parser";
import { ChevronLeft } from "lucide-react";
import React, { useEffect, useState } from "react";

// Simple path join for browser
const joinPath = (base: string, path: string): string => {
  if (!base) return path;
  if (path.startsWith("/")) return path;

  const baseParts = base.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);

  // Remove filename from base if present
  if (baseParts.length > 0 && baseParts[baseParts.length - 1].includes(".")) {
    baseParts.pop();
  }

  // Handle relative paths
  for (const part of pathParts) {
    if (part === "..") {
      baseParts.pop();
    } else if (part !== ".") {
      baseParts.push(part);
    }
  }

  return baseParts.join("/");
};

interface TableOfContentsProps {
  epub: EPub;
  currentChapterPath?: string;
  onChapterSelect: (href: string) => void;
  onClose?: () => void;
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({
  epub,
  currentChapterPath,
  onChapterSelect,
  onClose,
}) => {
  const [tocFile, setTocFile] = useState<XMLFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadToc = async () => {
      try {
        setIsLoading(true);
        // Get the TOC as HTML (automatically handles EPUB3 nav or NCX)
        const tocHtml = await epub.toc.html();
        setTocFile(tocHtml || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load TOC");
      } finally {
        setIsLoading(false);
      }
    };

    loadToc();
  }, [epub]);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const href = e.currentTarget.getAttribute("href");
    if (href) {
      onChapterSelect(href);
    }
  };

  const transformElement = (
    node: DOMNode,
  ): React.ReactElement | string | null => {
    if (node.type === "tag" && node.name === "a") {
      const element = node as Element;
      const href = element.attribs?.href;
      const isActive =
        currentChapterPath &&
        href &&
        joinPath(tocFile?.base || "", href.split("#")[0]) ===
          currentChapterPath;

      return (
        <a
          href={href}
          onClick={handleLinkClick}
          className={`block py-1 px-2 rounded hover:bg-gray-100 transition-colors ${
            isActive ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700"
          }`}
        >
          {element.children?.map((child, index) =>
            typeof child === "string" ? child : transformElement(child),
          )}
        </a>
      );
    }

    if (node.type === "tag") {
      const element = node as Element;
      return React.createElement(
        element.name,
        { key: Math.random() },
        element.children?.map(transformElement),
      );
    }

    if (node.type === "text") {
      return node.data || null;
    }

    return null;
  };

  if (isLoading) {
    return (
      <div className="p-4 text-gray-500">Loading table of contents...</div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500">Error loading TOC: {error}</div>;
  }

  if (!tocFile) {
    return (
      <div className="p-4 text-gray-500">No table of contents available</div>
    );
  }

  const tocContent = parse(tocFile.content, {
    replace: (domNode) => {
      if (domNode.type === "tag" || domNode.type === "text") {
        return transformElement(domNode);
      }
      return domNode;
    },
  });

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <h2 className="text-lg font-semibold">Table of Contents</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label="Close table of contents"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 epubtoc bg-white">
        {tocContent}
      </div>
    </div>
  );
};
