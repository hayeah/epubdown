import { Book, Menu, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import type { PdfReaderStore } from "../stores/PdfReaderStore";

interface PdfSidebarProps {
  store: PdfReaderStore;
  children?: React.ReactNode;
}

export const PdfSidebar = observer(({ store, children }: PdfSidebarProps) => {
  const [, navigate] = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { isSidebarOpen: isOpen } = store;

  // Setup event bindings for sidebar (escape key to close, bg click to close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        store.setSidebarOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        store.setSidebarOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, store]);

  const handleLibraryClick = () => {
    navigate("/");
  };

  return (
    <>
      {/* Collapsed sidebar - only expand button visible */}
      <div
        className={`absolute left-0 top-0 pt-8 ${
          isOpen ? "opacity-0 pointer-events-none" : "opacity-100"
        } hidden lg:flex`}
      >
        {/* Toggle button */}
        <button
          type="button"
          onClick={() => store.toggleSidebar()}
          className="ml-3 p-3 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
          aria-label="Open sidebar"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Expanded sidebar - absolutely positioned within sticky anchor */}
      <div
        ref={sidebarRef}
        className={`absolute left-0 top-0 ${
          isOpen ? "w-80" : "w-0"
        } h-screen pointer-events-auto overflow-hidden transition-all duration-300`}
      >
        <div className="h-full w-80 flex flex-col bg-gray-50">
          {/* Sidebar header with core features */}
          <div className="flex-shrink-0">
            <div className="p-4">
              <div className="flex items-center justify-end mb-4">
                <button
                  type="button"
                  onClick={() => store.toggleSidebar()}
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
              </div>
            </div>
          </div>

          {/* Table of contents or other content */}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </>
  );
});
