import { observer } from "mobx-react-lite";
import { createPortal } from "react-dom";
import { useCommandPaletteStore } from "./CommandPaletteContext";

export const SelectionOverlay = observer(() => {
  const store = useCommandPaletteStore();

  if (
    !store.isOpen ||
    store.mode !== "selection" ||
    store.selectionRects.length === 0
  ) {
    return null;
  }

  return createPortal(
    store.selectionRects.map((r) => (
      <div
        key={`${r.left}-${r.top}-${r.width}-${r.height}`}
        style={{
          position: "fixed",
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
          pointerEvents: "none",
          background: "rgba(59,130,246,0.15)",
          boxShadow: "0 0 0 1px rgba(59,130,246,0.6) inset",
          borderRadius: 2,
          zIndex: 9990,
        }}
      />
    )),
    document.body,
  );
});
