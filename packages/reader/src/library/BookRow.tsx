import { Trash2 } from "lucide-react";
import type React from "react";
import { Link } from "wouter";
import type { BookMetadata } from "../lib/BookDatabase";
import { formatRelative } from "../utils/dateUtils";

interface BookRowProps {
  book: BookMetadata;
  onDelete: (e: React.MouseEvent) => void;
  searchQuery: string;
}

export const BookRow: React.FC<BookRowProps> = ({
  book,
  onDelete,
  searchQuery,
}) => {
  // Highlight matching text
  const highlightText = (text: string) => {
    if (!searchQuery) return text;
    // Escape special regex characters
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

  const formatOpened = (last?: number, created?: number) => {
    if (last) return formatRelative(last);
    return "never";
  };

  return (
    <Link
      href={book.fileType === "pdf" ? `/pdf/${book.id}` : `/book/${book.id}`}
      className="flex items-center px-6 h-10 text-sm hover:bg-gray-50 border-b border-gray-100 cursor-pointer transition-colors duration-100 no-underline text-inherit group"
    >
      {/* Title and Author */}
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-baseline gap-2">
          {!book.lastOpenedAt && (
            <span
              className="inline-block w-2 h-2 rounded-full bg-blue-300 shrink-0"
              aria-label="Unread"
            />
          )}
          <span className="font-medium text-gray-900 truncate flex-shrink">
            {highlightText(book.title)}
            {book.fileType === "pdf" && (
              <span className="text-xs text-gray-500 ml-1">(pdf)</span>
            )}
          </span>
          <span className="text-gray-500 text-xs flex-shrink-0">
            {highlightText(book.author ?? "")}
          </span>
        </div>
      </div>

      {/* Last opened */}
      <div className="text-xs text-gray-500">
        <span>{formatOpened(book.lastOpenedAt, book.createdAt)}</span>
      </div>

      {/* Delete action - only visible on hover */}
      <div className="flex items-center ml-3 transition-opacity duration-150 opacity-0 group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onDelete(e);
          }}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          aria-label="Delete book"
        >
          <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
        </button>
      </div>
    </Link>
  );
};
