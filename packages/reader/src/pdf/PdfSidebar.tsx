import { Book } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { SidebarShell } from "../components/reader/SidebarShell";
import type { PdfReaderStore } from "../stores/PdfReaderStore";

interface PdfSidebarProps {
  store: PdfReaderStore;
  children?: React.ReactNode;
}

export const PdfSidebar = observer(({ store, children }: PdfSidebarProps) => {
  const [, navigate] = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { isSidebarOpen: isOpen } = store;

  // Setup event bindings for sidebar using EventSystem
  useEffect(() => {
    if (isOpen) {
      const dispose = store.setupBindings(
        "overlay:sidebar",
        undefined,
        () => sidebarRef.current,
      );
      return dispose;
    }
  }, [isOpen, store]);

  const featureButtons = [
    {
      icon: Book,
      label: "Library",
      onClick: () => navigate("/"),
      shortcut: "⌘L",
    },
  ];

  return (
    <SidebarShell
      isOpen={isOpen}
      onClose={() => store.toggleSidebar()}
      featureButtons={featureButtons}
      sidebarRef={sidebarRef}
    >
      {children}
    </SidebarShell>
  );
});
