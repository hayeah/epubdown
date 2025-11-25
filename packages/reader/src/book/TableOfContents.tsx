import { observer } from "mobx-react-lite";
import type React from "react";
import { useMemo, useState } from "react";
import { TocContainer } from "../components/reader/TocContainer";
import { TocListItem } from "../components/reader/TocListItem";
import { TocSearchBar } from "../components/reader/TocSearchBar";
import { useReaderStore } from "../stores/RootStore";

export const TableOfContents: React.FC = observer(() => {
  const readerStore = useReaderStore();
  const [searchQuery, setSearchQuery] = useState("");
  const navItems = readerStore.navItems;
  const currentChapterPath = readerStore.currentChapter?.path;

  // Filter nav items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return navItems;

    const query = searchQuery.toLowerCase();
    return navItems.filter((item) => item.label.toLowerCase().includes(query));
  }, [navItems, searchQuery]);

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    path: string,
  ) => {
    // Allow CMD+click (Mac) or Ctrl+click (Windows/Linux) to open in new tab
    if (e.metaKey || e.ctrlKey) {
      return;
    }

    e.preventDefault();
    readerStore.handleTocChapterSelect(path);
  };

  return (
    <TocContainer
      isEmpty={navItems.length === 0}
      emptyMessage="No table of contents available"
      headerTools={
        navItems.length > 0 && (
          <TocSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search chapters..."
          />
        )
      }
    >
      <ul>
        {filteredItems.map((item) => {
          const isActive = currentChapterPath === item.path;
          const indent = item.level * 1.5;
          const fullHref = readerStore.rootedHrefToBookHref(item.path) || "#";

          return (
            <TocListItem
              key={item.href}
              label={item.label}
              isActive={isActive}
              indent={indent}
              href={fullHref}
              onClick={(e) => handleLinkClick(e, item.path)}
            />
          );
        })}
      </ul>
      {filteredItems.length === 0 && searchQuery && (
        <div className="text-center text-gray-500 py-4">
          No chapters found matching "{searchQuery}"
        </div>
      )}
    </TocContainer>
  );
});
