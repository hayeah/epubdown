import { FileText, Image } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useMemo, useState } from "react";
import { TocContainer } from "../components/reader/TocContainer";
import { TocListItem } from "../components/reader/TocListItem";
import { TocSearchBar } from "../components/reader/TocSearchBar";
import type { CollectionReaderStore } from "../stores/CollectionReaderStore";

interface CollectionTableOfContentsProps {
  store: CollectionReaderStore;
  onNavigate: (filePath: string, headingId?: string) => Promise<void>;
}

// Generate a slug from heading text for use as an ID
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export const CollectionTableOfContents: React.FC<CollectionTableOfContentsProps> =
  observer(({ store, onNavigate }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const { tocItems, currentFilePath, currentHeadingId } = store;

    // Filter TOC items based on search query
    const filteredItems = useMemo(() => {
      if (!searchQuery.trim()) return tocItems;

      const query = searchQuery.toLowerCase();
      return tocItems.filter((item) => {
        // Always show media section header
        if (item.id === "media-section") return true;
        // Filter by label
        return item.label.toLowerCase().includes(query);
      });
    }, [tocItems, searchQuery]);

    const handleItemClick = async (
      e: React.MouseEvent<HTMLAnchorElement>,
      filePath: string,
      headingText?: string,
    ) => {
      e.preventDefault();
      const headingId = headingText ? slugify(headingText) : undefined;
      await onNavigate(filePath, headingId);
    };

    return (
      <TocContainer
        isEmpty={tocItems.length === 0}
        emptyMessage="No files in this collection"
        headerTools={
          tocItems.length > 0 && (
            <TocSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search files..."
            />
          )
        }
      >
        <ul>
          {filteredItems.map((item) => {
            const isMediaSection = item.id === "media-section";
            const isMediaItem = item.id.startsWith("media-");
            const indent = item.level;

            // Regular file/heading item
            const isHeading = item.headingIndex !== undefined;
            const headingText = isHeading ? item.label : undefined;

            // Check if this item is active
            let isActive = false;
            if (item.filePath === currentFilePath) {
              if (isHeading && headingText) {
                // For headings, check if the slug matches the current heading ID
                const headingSlug = slugify(headingText);
                isActive = headingSlug === currentHeadingId;
              } else if (item.level === 0 && !currentHeadingId) {
                // For top-level files, active when no heading is selected
                isActive = true;
              }
            }

            // Icon based on type
            let icon: React.ReactNode = null;
            if (item.level === 0 && !isMediaSection) {
              icon = <FileText className="w-4 h-4 text-gray-400 shrink-0" />;
            } else if (isMediaItem && !isMediaSection) {
              icon = <Image className="w-4 h-4 text-gray-400 shrink-0" />;
            }

            // Media section header
            if (isMediaSection) {
              return (
                <li key={item.id} className="mt-4 mb-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {item.label}
                  </div>
                </li>
              );
            }

            return (
              <TocListItem
                key={item.id}
                label={item.label}
                isActive={isActive}
                indent={indent}
                icon={icon}
                href={`#${item.filePath || ""}`}
                onClick={(e) =>
                  item.filePath &&
                  handleItemClick(e, item.filePath, headingText)
                }
              />
            );
          })}
        </ul>
        {filteredItems.length === 0 && searchQuery && (
          <div className="text-center text-gray-500 py-4">
            No files found matching "{searchQuery}"
          </div>
        )}
      </TocContainer>
    );
  });
