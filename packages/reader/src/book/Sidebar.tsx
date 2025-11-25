import { Book, Code2, Search } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { SidebarShell } from "../components/reader/SidebarShell";
import { useReaderStore } from "../stores/RootStore";

interface SidebarProps {
  children?: React.ReactNode;
}

export const Sidebar = observer(({ children }: SidebarProps) => {
  const [, navigate] = useLocation();
  const readerStore = useReaderStore();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { isSidebarOpen: isOpen } = readerStore;

  // Setup event bindings for sidebar
  useEffect(() => {
    if (isOpen) {
      const dispose = readerStore.setupBindings(
        "overlay:sidebar",
        undefined,
        () => sidebarRef.current,
      );
      return dispose;
    }
  }, [isOpen, readerStore]);

  const featureButtons = [
    {
      icon: Book,
      label: "Library",
      onClick: () => navigate("/"),
      shortcut: "⌘L",
    },
    {
      icon: Search,
      label: "Find Book",
      onClick: () => {},
      shortcut: "⌘F",
    },
    {
      icon: Code2,
      label: "HTML rendering",
      onClick: () => readerStore.setHtmlMode(!readerStore.useHtmlMode),
      rightContent: (
        <span className="text-xs text-gray-500">
          {readerStore.useHtmlMode ? "on" : "off"}
        </span>
      ),
    },
  ];

  return (
    <SidebarShell
      isOpen={isOpen}
      onClose={() => readerStore.toggleSidebar()}
      featureButtons={featureButtons}
      sidebarRef={sidebarRef}
    >
      {children}
    </SidebarShell>
  );
});
