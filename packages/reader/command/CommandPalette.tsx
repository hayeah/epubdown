import { observer } from "mobx-react-lite";
import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useCommandPaletteStore } from "../src/stores/RootStore";
import { CommandRow } from "./CommandRow";

export const CommandPalette = observer(() => {
  const store = useCommandPaletteStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    store.bindMenuElGetter(() => menuRef.current);
  }, [store]);

  useEffect(() => {
    if (!store.isOpen) return;
    const dispose = store.setupBindings(() => menuRef.current);
    return dispose;
  }, [store, store.isOpen]);

  useLayoutEffect(() => {
    if (!store.isOpen) return;
    // Focus the menu container to capture keyboard events
    menuRef.current?.focus({ preventScroll: true });
    store.computeMenuXY();
  }, [store, store.isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && store.selectedIndex >= 0) {
      const items = listRef.current.querySelectorAll("button");
      const selectedItem = items[store.selectedIndex];
      if (selectedItem) {
        const container = listRef.current;
        const itemTop = selectedItem.offsetTop;
        const itemBottom = itemTop + selectedItem.offsetHeight;
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.clientHeight;

        if (itemTop < containerTop) {
          container.scrollTop = itemTop;
        } else if (itemBottom > containerBottom) {
          container.scrollTop = itemBottom - container.clientHeight;
        }
      }
    }
  }, [store.selectedIndex]);

  if (!store.isOpen) return null;

  const isPalette = store.mode === "palette";
  const isSlide = store.mode === "slide";

  return createPortal(
    <>
      {isPalette && (
        <div
          className="fixed inset-0 bg-black/20 z-[9998]"
          onClick={() => store.close()}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter") {
              store.close();
            }
          }}
          role="button"
          tabIndex={-1}
          aria-label="Close command palette"
        />
      )}

      <div
        ref={menuRef}
        role="menu"
        tabIndex={-1}
        className="fixed bg-white border border-gray-200 rounded-lg z-[9999] overflow-hidden outline-none"
        style={{
          width: `${store.widthPx}px`,
          maxWidth: "calc(100vw - 20px)",
          maxHeight: isSlide ? "360px" : "400px",
          left: `${store.menuXY.x}px`,
          top: `${store.menuXY.y}px`,
          boxShadow: "0 2px 8px rgba(0,0,0,.15)",
        }}
        onKeyDown={(e) => {
          // Navigation keys
          if (e.key === "ArrowDown") {
            e.preventDefault();
            store.moveSelection(1);
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            store.moveSelection(-1);
            return;
          }
          if (e.key === "Home") {
            e.preventDefault();
            store.selectFirst();
            return;
          }
          if (e.key === "End") {
            e.preventDefault();
            store.selectLast();
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            store.executeSelected(() => store.close());
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            store.close();
            return;
          }

          // Filtering via typing (IME not supported by design)
          const printable =
            e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey;
          if (printable) {
            e.preventDefault();
            store.appendToQuery(e.key);
            return;
          }

          // Backspace to delete last character
          if (e.key === "Backspace" && !e.altKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            store.backspaceQuery();
            return;
          }

          // Cmd + Backspace clears query (Mac)
          if (e.key === "Backspace" && e.metaKey) {
            e.preventDefault();
            store.clearQuery();
            return;
          }
        }}
      >
        <div ref={listRef} className="overflow-y-auto max-h-80">
          {store.filtered.length > 0 ? (
            store.filtered.map((cmd, idx) => (
              <CommandRow
                key={cmd.id}
                command={cmd}
                isSelected={store.selectedIndex === idx}
                isHovered={store.hoveredIndex === idx}
                onClick={() => {
                  store.executeSelected(() => store.close(), idx);
                }}
                onMouseEnter={() => {
                  store.setHoveredIndex(idx);
                }}
                onMouseLeave={() => {
                  store.setHoveredIndex(null);
                }}
                query={store.query}
              />
            ))
          ) : (
            <div className="px-3 py-8 text-center text-sm text-gray-500">
              {store.query ? (
                <>
                  <p className="mb-2">No match</p>
                  <p className="text-xs text-gray-400">
                    Try a different search term
                  </p>
                </>
              ) : (
                <p>No commands available</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
});
