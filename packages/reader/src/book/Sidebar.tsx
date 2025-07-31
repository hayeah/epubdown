import { Book, Menu, Search, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useReaderStore } from "../stores/RootStore";

interface SidebarProps {
  children?: React.ReactNode;
}

export const Sidebar = observer(({ children }: SidebarProps) => {
  const [, navigate] = useLocation();
  const readerStore = useReaderStore();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { isSidebarOpen: isOpen } = readerStore;
  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Shift+S (Mac) or Ctrl+Shift+S (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "s") {
        e.preventDefault();
        readerStore.toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [readerStore]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        readerStore.toggleSidebar();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, readerStore]);

  const handleLibraryClick = () => {
    navigate("/");
  };

  return (
    <>
      {/* Collapsed sidebar - icon buttons positioned to the left of content */}
      <div
        className={`absolute left-0 top-0 pt-8 w-16 ${
          isOpen ? "opacity-0 pointer-events-none" : "opacity-100"
        } hidden lg:flex flex-col items-center`}
      >
        {/* Toggle button */}
        <button
          type="button"
          onClick={() => readerStore.toggleSidebar()}
          className="p-3 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
          aria-label="Open sidebar"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Library button */}
        <button
          type="button"
          onClick={handleLibraryClick}
          className="p-3 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
          aria-label="Go to library"
        >
          <Book className="w-6 h-6" />
        </button>

        {/* Find book button (placeholder) */}
        <button
          type="button"
          onClick={() => {}}
          className="p-3 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
          aria-label="Find book"
        >
          <Search className="w-6 h-6" />
        </button>
      </div>

      {/* Expanded sidebar - absolutely positioned within sticky anchor */}
      <div
        ref={sidebarRef}
        className={`absolute left-0 top-0 ${
          isOpen ? "w-80" : "w-0"
        } h-screen pointer-events-auto`}
      >
        <div className="h-full flex flex-col overflow-y-auto bg-gray-50">
          {/* Sidebar header with core features */}
          <div>
            <div className="p-4">
              <div className="flex items-center justify-end mb-4">
                <button
                  type="button"
                  onClick={() => readerStore.toggleSidebar()}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  aria-label="Close sidebar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Core feature buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleLibraryClick}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Book className="w-5 h-5 text-gray-600" />
                    <span>Library</span>
                  </div>
                  <span className="text-xs text-gray-500">⌘L</span>
                </button>

                <button
                  type="button"
                  onClick={() => {}}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Search className="w-5 h-5 text-gray-600" />
                    <span>Find Book</span>
                  </div>
                  <span className="text-xs text-gray-500">⌘F</span>
                </button>
              </div>
            </div>
          </div>

          {/* Table of contents or other content */}
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </>
  );
});
