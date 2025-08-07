import { Trash2 } from "lucide-react";
import type React from "react";
import { Link } from "wouter";
import type { BookMetadata } from "../lib/BookDatabase";

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

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <Link
      href={`/book/${book.id}`}
      className="flex items-center px-6 h-10 text-sm hover:bg-gray-50 border-b border-gray-100 cursor-pointer transition-colors duration-100 no-underline text-inherit group"
    >
      {/* Title and Author */}
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-gray-900 truncate">
            {highlightText(book.title)}
          </span>
          <span className="text-gray-500 text-xs truncate">
            {highlightText(book.author ?? "")}
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>{formatFileSize(book.fileSize)}</span>
        <span>
          {book.lastOpenedAt
            ? formatDate(book.lastOpenedAt)
            : formatDate(book.createdAt)}
        </span>
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
