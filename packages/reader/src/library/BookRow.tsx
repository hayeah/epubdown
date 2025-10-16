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
      href={`/book/${book.id}`}
      className="flex flex-col gap-2 sm:flex-row sm:items-center px-4 sm:px-6 py-3 text-sm hover:bg-gray-50 border-b border-gray-100 cursor-pointer transition-colors duration-100 no-underline text-inherit group"
    >
      {/* Title and Author */}
      <div className="flex min-w-0 items-baseline gap-2">
        {!book.lastOpenedAt && (
          <span
            className="inline-block w-2 h-2 rounded-full bg-blue-300 shrink-0"
            aria-label="Unread"
          />
        )}
        <span className="font-medium text-gray-900 truncate">
          {highlightText(book.title)}
        </span>
        {book.author && (
          <span className="text-gray-500 text-xs truncate">
            {highlightText(book.author)}
          </span>
        )}
      </div>

      {/* Last opened */}
      <div className="flex items-center justify-between w-full gap-3 sm:w-auto sm:gap-2 sm:ml-auto sm:justify-end">
        <span className="text-xs text-gray-500">
          {formatOpened(book.lastOpenedAt, book.createdAt)}
        </span>

        {/* Delete action - hover on desktop, always visible on touch */}
        <div className="flex items-center transition-opacity duration-150 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
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
      </div>
    </Link>
  );
};
