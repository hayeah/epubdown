import type React from "react";
import { createContext, useContext, useEffect, useRef } from "react";
import { CommandPaletteStore } from "./CommandPaletteStore";

const Ctx = createContext<CommandPaletteStore | null>(null);

export const CommandPaletteProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const storeRef = useRef<CommandPaletteStore | null>(null);
  if (!storeRef.current) storeRef.current = new CommandPaletteStore();
  const store = storeRef.current;

  // Built-in close triggers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && store.isOpen) {
        e.preventDefault();
        store.close();
      }
    };

    const onScroll = () => {
      if (store.isOpen && store.mode === "selection") {
        store.close();
      }
    };

    const onClickOutside = (e: MouseEvent) => {
      if (!store.isOpen || store.mode === "palette") return;

      // Don't close if there's selected text (user might be selecting)
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        return;
      }

      const menuEl = document.querySelector('[role="menu"]');
      if (menuEl && !menuEl.contains(e.target as Node)) {
        // Small delay to avoid immediate close on open
        setTimeout(() => {
          if (store.isOpen) store.close();
        }, 100);
      }
    };

    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mousedown", onClickOutside);

    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [store]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
};

export function useCommandPaletteStore(): CommandPaletteStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("CommandPaletteProvider missing");
  return ctx;
}
