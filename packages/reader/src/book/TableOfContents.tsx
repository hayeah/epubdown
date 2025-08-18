import { ChevronLeft } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useReaderStore } from "../stores/RootStore";

export const TableOfContents: React.FC = observer(() => {
  const readerStore = useReaderStore();
  const navItems = readerStore.navItems;

  const currentChapterPath = readerStore.currentChapter?.path;

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    path: string,
  ) => {
    // Allow CMD+click (Mac) or Ctrl+click (Windows/Linux) to open in new tab
    if (e.metaKey || e.ctrlKey) {
      // Let the browser handle the new tab naturally
      return;
    }

    // Otherwise prevent default and use the callback
    e.preventDefault();
    readerStore.handleTocChapterSelect(path);
  };

  if (navItems.length === 0) {
    return (
      <div className="p-4 text-gray-500">No table of contents available</div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex items-center justify-end bg-white">
        <button
          type="button"
          onClick={() => readerStore.setSidebarOpen(false)}
          className="lg:hidden p-1 hover:bg-gray-100 rounded transition-colors"
          aria-label="Close table of contents"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        <ul>
          {navItems.map((item) => {
            const isActive = currentChapterPath === item.path;

            // Calculate indentation based on level
            const indent = item.level * 1.5; // 1.5rem per level

            // Split path and fragment
            const [pathPart, fragment] = item.path.split("#");

            // Find chapter index for this path
            const chapterIndex = readerStore.findChapterIndexByPath(item.path);

            // Generate the full URL for this chapter with fragment if present
            let fullHref = "#";
            if (readerStore.currentBookId && chapterIndex !== -1) {
              const baseUrl = `/book/${readerStore.currentBookId}/${chapterIndex}`;
              fullHref = fragment ? `${baseUrl}#${fragment}` : baseUrl;
            }

            return (
              <li key={item.href} style={{ paddingLeft: `${indent}rem` }}>
                <a
                  href={fullHref}
                  onClick={(e) => handleLinkClick(e, item.path)}
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
});
