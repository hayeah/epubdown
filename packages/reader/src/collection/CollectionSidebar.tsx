import { Book, Download } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useRef } from "react";
import { useLocation } from "wouter";
import { SidebarShell } from "../components/reader/SidebarShell";
import type { CollectionReaderStore } from "../stores/CollectionReaderStore";
import type { CollectionStore } from "../stores/CollectionStore";

interface CollectionSidebarProps {
  store: CollectionReaderStore;
  collectionStore: CollectionStore;
  children?: React.ReactNode;
}

export const CollectionSidebar: React.FC<CollectionSidebarProps> = observer(
  ({ store, collectionStore, children }) => {
    const [, navigate] = useLocation();
    const sidebarRef = useRef<HTMLDivElement>(null);
    const { isSidebarOpen: isOpen, collection } = store;

    const handleExport = async () => {
      if (!collection) return;
      try {
        const blob = await collectionStore.exportCollection(collection.id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${collection.name}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Failed to export collection:", error);
      }
    };

    const featureButtons = [
      {
        icon: Book,
        label: "Library",
        onClick: () => navigate("/"),
        shortcut: "⌘L",
      },
      {
        icon: Download,
        label: "Export as ZIP",
        onClick: handleExport,
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
  },
);
