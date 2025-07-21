import type { EPub, FlatNavItem } from "@epubdown/core";
import { ChevronLeft } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

// Simple path join for browser
const joinPath = (base: string, path: string): string => {
  if (!base) return path;
  if (path.startsWith("/")) return path;

  const baseParts = base.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);

  // Remove filename from base if present
  if (baseParts.length > 0 && baseParts[baseParts.length - 1]?.includes(".")) {
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
  const [navItems, setNavItems] = useState<FlatNavItem[]>([]);
  const [tocBase, setTocBase] = useState<string>("");

  useEffect(() => {
    const loadToc = async () => {
      // Get the flat navigation items
      const items = await epub.toc.flatNavItems();
      setNavItems(items);

      // Get the TOC base path for resolving relative URLs
      const tocFile = await epub.toc.html();
      if (tocFile) {
        setTocBase(tocFile.base);
      }
    };

    loadToc();
  }, [epub]);

  const handleLinkClick = (href: string) => {
    onChapterSelect(href);
  };

  if (navItems.length === 0) {
    return (
      <div className="p-4 text-gray-500">
        No table of contents available
        {tocBase && <div className="text-xs mt-2">TOC base: {tocBase}</div>}
      </div>
    );
  }

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
        <ul>
          {navItems.map((item) => {
            const href = item.href;
            const hrefPath = href.split("#")[0] || "";
            const resolvedPath = tocBase
              ? joinPath(tocBase, hrefPath)
              : hrefPath;
            const isActive = currentChapterPath === resolvedPath;

            // Calculate indentation based on level
            const indent = item.level * 1.5; // 1.5rem per level

            return (
              <li key={item.href} style={{ paddingLeft: `${indent}rem` }}>
                <a
                  href={href}
                  onClick={(e) => {
                    e.preventDefault();
                    handleLinkClick(href);
                  }}
                  className={`block py-1 px-2 rounded hover:bg-gray-100 transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-600 font-medium"
                      : "text-gray-700"
                  }`}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
