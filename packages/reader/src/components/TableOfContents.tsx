import type { EPub, FlatNavItem } from "@epubdown/core";
import { ChevronLeft } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useEffect, useState } from "react";
import { useReaderStore } from "../stores/RootStore";

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

export const TableOfContents: React.FC<TableOfContentsProps> = observer(
  ({ epub, currentChapterPath, onChapterSelect, onClose }) => {
    const readerStore = useReaderStore();
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

    const handleLinkClick = (
      e: React.MouseEvent<HTMLAnchorElement>,
      href: string,
    ) => {
      // Allow CMD+click (Mac) or Ctrl+click (Windows/Linux) to open in new tab
      if (e.metaKey || e.ctrlKey) {
        // Let the browser handle the new tab naturally
        return;
      }

      // Otherwise prevent default and use the callback
      e.preventDefault();
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
        <div className="flex items-center justify-end bg-white">
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
        <div className="flex-1 overflow-y-auto p-4 bg-white">
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

              // Find chapter index for this href
              const chapterIndex = readerStore.chapters.findIndex((chapter) => {
                const chapterPath = chapter.path;
                const tocBasePath = readerStore.epub?.opf.base || "";

                const resolvedHref = hrefPath?.startsWith("/")
                  ? hrefPath
                  : `${tocBasePath}/${hrefPath}`.replace(/\/+/g, "/");

                return (
                  chapterPath === resolvedHref ||
                  (hrefPath ? chapterPath.endsWith(hrefPath) : false)
                );
              });

              // Generate the full URL for this chapter
              const fullHref =
                readerStore.currentBookId && chapterIndex !== -1
                  ? `/book/${readerStore.currentBookId}/${chapterIndex}`
                  : "#";

              return (
                <li key={item.href} style={{ paddingLeft: `${indent}rem` }}>
                  <a
                    href={fullHref}
                    onClick={(e) => handleLinkClick(e, href)}
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
  },
);
