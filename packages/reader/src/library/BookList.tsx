import { observer } from "mobx-react-lite";
import type React from "react";
import type { BookMetadata } from "../lib/BookDatabase";
import type { BookMetadata as NewBookMetadata } from "../lib/LibraryStore";
import { useBookLibraryStore } from "../stores/RootStore";
import { BookRow } from "./BookRow";

interface BookListProps {
  books?: (BookMetadata | NewBookMetadata)[];
  searchQuery?: string;
  isFilesystem?: boolean;
  onRefresh?: () => void;
}

export const BookList = observer(
  ({
    books: propBooks,
    searchQuery: propSearchQuery,
    isFilesystem = false,
    onRefresh,
  }: BookListProps) => {
    const store = useBookLibraryStore();

    // Use props if provided, otherwise fall back to store
    const books = propBooks ?? store.books;
    const searchQuery = propSearchQuery ?? store.searchQuery;

    const handleDelete = (bookId: number | string, event: React.MouseEvent) => {
      event.stopPropagation();
      if (confirm("Are you sure you want to delete this book?")) {
        store.deleteBook(Number(bookId));
        onRefresh?.();
      }
    };

    const title = searchQuery ? "Search Results" : "Library";

    return (
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <div className="px-4 sm:px-6 py-2 bg-gray-50 border-b border-gray-200">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            {title} ({books.length})
          </span>
        </div>
        {books.length > 0 ? (
          books.map((book) => {
            // Normalize to the shape BookRow expects
            const normalized: BookMetadata = {
              id:
                typeof book.id === "string"
                  ? Number.parseInt(book.id, 10) || 0
                  : book.id,
              title: book.title,
              author: book.author,
              filename: book.filename || "",
              fileSize: book.fileSize || 0,
              createdAt: ("createdAt" in book ? book.createdAt : 0) as number,
              lastOpenedAt: book.lastOpenedAt,
              contentHash: ("contentHash" in book
                ? book.contentHash
                : new Uint8Array()) as Uint8Array,
              fileType: book.fileType,
            };
            return (
              <BookRow
                key={book.id}
                book={normalized}
                bookId={String(book.id)}
                onDelete={
                  isFilesystem ? undefined : (e) => handleDelete(book.id, e)
                }
                searchQuery={searchQuery}
              />
            );
          })
        ) : searchQuery ? (
          <div className="px-4 sm:px-6 py-16 text-center">
            <p className="text-gray-500">No books match '{searchQuery}'</p>
          </div>
        ) : (
          <div className="px-4 sm:px-6 py-16 text-center">
            <p className="text-gray-500">No books in this library</p>
          </div>
        )}
      </div>
    );
  },
);
