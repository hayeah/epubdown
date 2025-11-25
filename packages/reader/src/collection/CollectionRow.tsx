import { FolderOpen, Trash2 } from "lucide-react";
import type React from "react";
import { Link } from "wouter";
import type { CollectionMetadata } from "../lib/CollectionDatabase";
import { formatRelative } from "../utils/dateUtils";

interface CollectionRowProps {
  collection: CollectionMetadata;
  onDelete: (e: React.MouseEvent) => void;
  searchQuery: string;
}

export const CollectionRow: React.FC<CollectionRowProps> = ({
  collection,
  onDelete,
  searchQuery,
}) => {
  // Highlight matching text
  const highlightText = (text: string) => {
    if (!searchQuery) return text;
    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedQuery})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) => {
      const key = `${text.substring(0, 10)}-${i}`;
      return regex.test(part) ? (
        <span key={key} className="bg-yellow-300 font-medium">
          {part}
        </span>
      ) : (
        part
      );
    });
  };

  const formatOpened = (last?: number) => {
    if (last) return formatRelative(last);
    return "never";
  };

  return (
    <Link
      href={`/collection/${collection.id}`}
      className="flex gap-3 px-4 sm:px-6 py-3 text-sm hover:bg-gray-50 border-b border-gray-100 cursor-pointer transition-colors duration-100 no-underline text-inherit group"
    >
      {/* Icon */}
      <div className="flex items-start pt-1">
        <FolderOpen className="w-4 h-4 text-amber-500" />
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="break-words">
          <span className="font-medium text-gray-900">
            {highlightText(collection.name)}
            <span className="text-xs text-gray-500 ml-1">(md)</span>
          </span>
        </div>
      </div>

      {/* Last opened and delete */}
      <div className="flex items-center gap-2 shrink-0 sm:w-24 sm:justify-end">
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {formatOpened(collection.lastOpenedAt)}
        </span>

        <div className="flex items-center transition-opacity duration-150 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onDelete(e);
            }}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            aria-label="Delete collection"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
          </button>
        </div>
      </div>
    </Link>
  );
};
