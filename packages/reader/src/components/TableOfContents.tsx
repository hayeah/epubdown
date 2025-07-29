import type { EPub, FlatNavItem } from "@epubdown/core";
import { ChevronLeft } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useEffect, useState } from "react";
import { useReaderStore } from "../stores/RootStore";
import { resolveTocHref } from "../utils/pathUtils";

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
        const tocInfo = await readerStore.getTocInfo();
        if (tocInfo) {
          setNavItems(tocInfo.navItems);
          setTocBase(tocInfo.tocBase);
        }
      };

      loadToc();
    }, [readerStore]);

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
              const resolvedPath = resolveTocHref(tocBase, href);
              const isActive = currentChapterPath === resolvedPath;

              // Calculate indentation based on level
              const indent = item.level * 1.5; // 1.5rem per level

              // Find chapter index for this href
              const chapterIndex = readerStore.findChapterIndexByHref(href);

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
