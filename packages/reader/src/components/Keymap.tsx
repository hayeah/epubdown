import { observer } from "mobx-react-lite";
import type React from "react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useBookLibraryStore, useReaderStore } from "../stores/RootStore";

type KeyCombo = {
  key: string;
  cmd?: boolean; // abstract: ctrl on Windows/Linux, cmd on Mac
  ctrl?: boolean; // explicit ctrl key on all platforms
  meta?: boolean;
  shift?: boolean;
};

function matchCombo(event: KeyboardEvent, combo: KeyCombo): boolean {
  const keyMatch = event.key.toLowerCase() === combo.key.toLowerCase();

  // Handle modifiers
  let modifierMatch = true;

  // cmd: abstract cross-platform modifier (Ctrl on Windows/Linux, Cmd on Mac)
  if (combo.cmd) {
    const isMac = navigator.platform.toLowerCase().includes("mac");
    modifierMatch = modifierMatch && (isMac ? event.metaKey : event.ctrlKey);
  }

  // ctrl: explicit ctrl key on all platforms
  if (combo.ctrl) {
    modifierMatch = modifierMatch && event.ctrlKey;
  }

  // meta: explicit meta/cmd key
  if (combo.meta) {
    modifierMatch = modifierMatch && event.metaKey;
  }

  const shiftMatch =
    combo.shift === undefined ? true : combo.shift === event.shiftKey;

  return keyMatch && modifierMatch && shiftMatch;
}

function preventIfMatch(event: KeyboardEvent, combo: KeyCombo): boolean {
  if (matchCombo(event, combo)) {
    event.preventDefault();
    return true;
  }
  return false;
}

interface KeymapProps {
  children: React.ReactNode;
}

export const Keymap = observer(({ children }: KeymapProps) => {
  const readerStore = useReaderStore();
  const bookLibraryStore = useBookLibraryStore();
  const [pathname] = useLocation();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Build array of active shortcuts based on current state
      const shortcuts: Array<[KeyCombo, () => void]> = [];

      // Copy with context - only active when reading a chapter
      if (readerStore.currentChapterRender) {
        shortcuts.push([
          { key: "C", cmd: true, shift: true },
          () => {
            readerStore.copySelectionWithContext();
          },
        ]);
      }

      // Toggle sidebar - always active in reader view
      if (readerStore.epub) {
        shortcuts.push([
          { key: "S", cmd: true, shift: true },
          () => {
            readerStore.toggleSidebar();
          },
        ]);
      }

      // Focus search bar - only on library page
      if (pathname === "/" && bookLibraryStore) {
        shortcuts.push([
          { key: "/" },
          () => {
            // Prevent if already focused on an input
            const activeElement = document.activeElement;
            if (
              activeElement?.tagName === "INPUT" ||
              activeElement?.tagName === "TEXTAREA"
            ) {
              return;
            }
            bookLibraryStore.focusSearchBar();
          },
        ]);
      }

      // Process shortcuts
      for (const [combo, callback] of shortcuts) {
        if (preventIfMatch(event, combo)) {
          callback();
          break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [readerStore, bookLibraryStore, pathname]);

  return <>{children}</>;
});
