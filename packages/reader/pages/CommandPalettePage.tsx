import {
  Book,
  ChevronRight,
  Copy,
  FileText,
  Highlighter,
  Home,
  MessageSquare,
  Search,
  Settings,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommandPalette } from "../command/CommandPalette";
import { CommandPaletteStore } from "../command/CommandPaletteStore";
import type { Command } from "../command/types";
import type { AppCtx, AppLayers } from "../src/app/context";
import { EventSystem } from "../src/events/EventSystem";

const DemoInner = observer(({ store }: { store: CommandPaletteStore }) => {
  const textRef = useRef<HTMLDivElement>(null);
  const contextButtonRef = useRef<HTMLButtonElement>(null);
  const selectionTimer = useRef<NodeJS.Timeout | null>(null);
  const [selectedText, setSelectedText] = useState("");

  const globalCommands: Command[] = useMemo(
    () => [
      {
        id: "open-file",
        label: "Open File",
        shortcut: "⌘P",
        icon: <FileText className="w-4 h-4" />,
        category: "File",
        keywords: ["file", "open", "browse"],
        action: () => {
          store.setLastAction("Open File");
        },
        popularity: 0.9,
      },
      {
        id: "search",
        label: "Search Everywhere",
        shortcut: "⌘K",
        icon: <Search className="w-4 h-4" />,
        category: "Search",
        keywords: ["find", "search", "look"],
        action: () => {
          store.setLastAction("Search Everywhere");
        },
        popularity: 0.95,
      },
      {
        id: "go-home",
        label: "Go to Library",
        shortcut: "⌘L",
        icon: <Home className="w-4 h-4" />,
        category: "Navigate",
        keywords: ["home", "library", "books"],
        action: () => {
          store.setLastAction("Go to Library");
        },
        popularity: 0.8,
      },
      {
        id: "settings",
        label: "Settings",
        shortcut: "⌘,",
        icon: <Settings className="w-4 h-4" />,
        category: "System",
        keywords: ["preferences", "config", "options"],
        action: () => {
          store.setLastAction("Open Settings");
        },
        popularity: 0.6,
      },
      {
        id: "bookmark",
        label: "Add Bookmark",
        icon: <Star className="w-4 h-4" />,
        category: "Book",
        keywords: ["star", "favorite", "pin"],
        action: () => {
          store.setLastAction("Add Bookmark");
        },
        popularity: 0.7,
      },
      {
        id: "next-chapter",
        label: "Next Chapter",
        shortcut: "→",
        icon: <ChevronRight className="w-4 h-4" />,
        category: "Navigate",
        keywords: ["forward", "next"],
        action: () => {
          store.setLastAction("Next Chapter");
        },
        popularity: 0.85,
      },
    ],
    [store],
  );

  const contextCommands: Command[] = useMemo(
    () => [
      {
        id: "copy",
        label: "Copy",
        shortcut: "⌘C",
        icon: <Copy className="w-4 h-4" />,
        scope: "context",
        action: () => {
          store.setLastAction("Copy");
        },
      },
      {
        id: "delete",
        label: "Delete",
        icon: <Trash2 className="w-4 h-4" />,
        scope: "context",
        action: () => {
          store.setLastAction("Delete");
        },
      },
      {
        id: "open-book",
        label: "Open Book",
        icon: <Book className="w-4 h-4" />,
        scope: "context",
        action: () => {
          store.setLastAction("Open Book");
        },
      },
    ],
    [store],
  );

  const createTextSelectionCommands = useCallback(
    (selected: string): Command[] => [
      {
        id: "copy-text",
        label: `Copy "${selected.substring(0, 20)}${selected.length > 20 ? "..." : ""}"`,
        shortcut: "⌘C",
        icon: <Copy className="w-4 h-4" />,
        scope: "context",
        action: () => {
          navigator.clipboard.writeText(selected);
          store.setLastAction(`Copied: "${selected.substring(0, 30)}..."`);
          store.close();
        },
      },
      {
        id: "highlight",
        label: "Highlight",
        icon: <Highlighter className="w-4 h-4" />,
        scope: "context",
        action: () => {
          store.setLastAction(`Highlighted: "${selected.substring(0, 30)}..."`);
          store.close();
        },
      },
      {
        id: "add-note",
        label: "Add Note",
        icon: <MessageSquare className="w-4 h-4" />,
        scope: "context",
        action: () => {
          store.setLastAction(`Add note to: "${selected.substring(0, 30)}..."`);
          store.close();
        },
      },
      {
        id: "share-text",
        label: "Share",
        icon: <Share2 className="w-4 h-4" />,
        scope: "context",
        action: () => {
          store.setLastAction(`Share: "${selected.substring(0, 30)}..."`);
          store.close();
        },
      },
      {
        id: "search-text",
        label: "Search in Book",
        icon: <Search className="w-4 h-4" />,
        scope: "context",
        action: () => {
          store.setLastAction(`Search for: "${selected.substring(0, 30)}..."`);
          store.close();
        },
      },
    ],
    [store],
  );

  // App handles keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "p")) {
        e.preventDefault();
        store.openPalette(globalCommands);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [store, globalCommands]);

  // App handles text selection
  useEffect(() => {
    const handleTextSelection = (e: MouseEvent) => {
      // Clear any existing timeout
      if (selectionTimer.current) clearTimeout(selectionTimer.current);

      // Only handle mouseup in the text container
      if (!textRef.current?.contains(e.target as Node)) {
        return;
      }

      // Small delay to let selection complete
      selectionTimer.current = setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (!text || !sel || sel.rangeCount === 0) return;

        setSelectedText(text);
        const cmds = createTextSelectionCommands(text);
        store.openSelection(cmds, { range: sel.getRangeAt(0) });
      }, 50);
    };

    const handleSelectionClear = (e: MouseEvent) => {
      // If clicking outside text container and menu, clear selection
      const target = e.target as Node;
      if (
        !textRef.current?.contains(target) &&
        !document.querySelector('[role="menu"]')?.contains(target)
      ) {
        if (selectionTimer.current) clearTimeout(selectionTimer.current);
      }
    };

    document.addEventListener("mouseup", handleTextSelection);
    document.addEventListener("mousedown", handleSelectionClear);

    return () => {
      if (selectionTimer.current) clearTimeout(selectionTimer.current);
      document.removeEventListener("mouseup", handleTextSelection);
      document.removeEventListener("mousedown", handleSelectionClear);
    };
  }, [store, createTextSelectionCommands]);

  // Context menu handler
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    store.openMenu([...contextCommands, ...globalCommands], {
      anchorElement: e.target as HTMLElement,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Command Palette & Menu
        </h1>

        {/* Demo Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Demo Controls</h2>

          <div className="space-y-4">
            {/* Command Palette */}
            <div>
              <button
                type="button"
                onClick={() => store.openPalette(globalCommands)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Open Command Palette
              </button>
              <span className="ml-3 text-sm text-gray-500">
                or press <kbd className="px-2 py-1 bg-gray-100 rounded">⌘K</kbd>
              </span>
            </div>

            {/* Context Menu */}
            <div>
              <button
                ref={contextButtonRef}
                type="button"
                onClick={() => {
                  store.openMenu([...contextCommands, ...globalCommands], {
                    anchorElement: contextButtonRef.current,
                  });
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Open Context Menu
              </button>
              <span className="ml-3 text-sm text-gray-500">
                anchored to button
              </span>
            </div>

            {/* Slide Mode */}
            <div>
              <button
                type="button"
                onClick={() => store.openSlide(globalCommands)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Open Slide Menu
              </button>
              <span className="ml-3 text-sm text-gray-500">
                slides down from top
              </span>
            </div>

            {/* Last Action Display */}
            {store.lastAction && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                <span className="text-sm font-medium text-green-800">
                  Last action: {store.lastAction}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Interactive Area */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Interactive Area</h2>
          <p className="text-gray-600 mb-4">
            Right-click anywhere in this area to open a context menu
          </p>

          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 min-h-[200px] flex items-center justify-center"
            onContextMenu={handleContextMenu}
          >
            <div className="text-center text-gray-500">
              <p>Right-click for context menu</p>
              <p className="text-sm mt-2">⌘K for command palette</p>
            </div>
          </div>
        </div>

        {/* Text Selection Area */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Text Selection Example</h2>
          <p className="text-gray-600 mb-4">
            Select any text in the paragraph below to see a context menu
          </p>

          <div
            ref={textRef}
            className="prose prose-lg max-w-none p-4 bg-gray-50 rounded-lg select-text"
          >
            <p className="text-gray-800 leading-relaxed">
              The command palette is a powerful interface pattern that provides
              quick access to application features through a searchable,
              keyboard-driven menu. Originally popularized by code editors like
              Sublime Text and Visual Studio Code, this pattern has become
              increasingly common in modern web applications.
            </p>

            <p className="text-gray-800 leading-relaxed mt-4">
              When users select text within a reading interface, contextual
              actions should appear nearby without disrupting the reading flow.
              Smart positioning algorithms ensure the menu appears in the
              optimal location relative to the selection, adapting to viewport
              boundaries and avoiding content obstruction.
            </p>

            <p className="text-gray-800 leading-relaxed mt-4">
              This implementation demonstrates how text selection can trigger a
              context-specific command palette, offering actions like
              highlighting, note-taking, and sharing. The menu intelligently
              positions itself around the selected text, providing a seamless
              user experience for readers who want to interact with content.
            </p>
          </div>
        </div>

        {/* Feature List */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Features Implemented</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>✓ MobX store-driven architecture</li>
            <li>✓ Context provider and hooks</li>
            <li>✓ Fuzzy search with highlighting</li>
            <li>✓ Keyboard navigation (arrows, Enter, Escape)</li>
            <li>✓ Recent commands tracking</li>
            <li>✓ Context-aware positioning</li>
            <li>✓ Multiple modes: palette, menu, slide, selection</li>
            <li>✓ Command ranking by relevance, recency, and popularity</li>
            <li>✓ Categories and shortcuts display</li>
            <li>✓ Empty state with suggestions</li>
            <li>✓ Responsive width based on mode</li>
            <li>✓ Visual feedback for selection</li>
            <li>✓ Text selection detection with smart menu positioning</li>
            <li>✓ Context-specific commands for selected text</li>
          </ul>
        </div>
      </div>

      <CommandPalette />
    </div>
  );
});

export default function CommandPalettePage() {
  // Create standalone instances for the prototype page
  const [store] = useState(() => {
    const eventSystem = new EventSystem();
    return new CommandPaletteStore(eventSystem);
  });

  return <DemoInner store={store} />;
}
