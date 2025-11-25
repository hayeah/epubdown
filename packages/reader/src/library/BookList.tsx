import { observer } from "mobx-react-lite";
import type React from "react";
import { useMemo } from "react";
import { CollectionRow } from "../collection/CollectionRow";
import type { BookMetadata } from "../lib/BookDatabase";
import type { CollectionMetadata } from "../lib/CollectionDatabase";
import { useBookLibraryStore, useCollectionStore } from "../stores/RootStore";
import { BookRow } from "./BookRow";

// Unified library item type for mixed sorting
type LibraryItem =
  | { type: "book"; data: BookMetadata }
  | { type: "collection"; data: CollectionMetadata };

export const BookList = observer(() => {
  const bookStore = useBookLibraryStore();
  const collectionStore = useCollectionStore();

  const handleDeleteBook = (bookId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    if (confirm("Are you sure you want to delete this book?")) {
      bookStore.deleteBook(bookId);
    }
  };

  const handleDeleteCollection = (
    collectionId: number,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    if (confirm("Are you sure you want to delete this collection?")) {
      collectionStore.deleteCollection(collectionId);
    }
  };

  // Create unified sorted list of books and collections
  const libraryItems = useMemo((): LibraryItem[] => {
    const items: LibraryItem[] = [
      ...bookStore.books.map(
        (book) => ({ type: "book", data: book }) as LibraryItem,
      ),
      ...collectionStore.collections.map(
        (collection) =>
          ({ type: "collection", data: collection }) as LibraryItem,
      ),
    ];

    // Sort by lastOpenedAt (most recent first), then by createdAt
    items.sort((a, b) => {
      const aTime = a.data.lastOpenedAt ?? a.data.createdAt;
      const bTime = b.data.lastOpenedAt ?? b.data.createdAt;
      return bTime - aTime;
    });

    return items;
  }, [bookStore.books, collectionStore.collections]);

  const title = bookStore.searchQuery ? "Search Results" : "Library";

  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      <div className="px-4 sm:px-6 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
          {title} ({libraryItems.length})
        </span>
      </div>
      {libraryItems.length > 0 ? (
        libraryItems.map((item) =>
          item.type === "book" ? (
            <BookRow
              key={`book-${item.data.id}`}
              book={item.data}
              onDelete={(e) => handleDeleteBook(item.data.id, e)}
              searchQuery={bookStore.searchQuery}
            />
          ) : (
            <CollectionRow
              key={`collection-${item.data.id}`}
              collection={item.data}
              onDelete={(e) => handleDeleteCollection(item.data.id, e)}
              searchQuery={bookStore.searchQuery}
            />
          ),
        )
      ) : bookStore.searchQuery ? (
        <div className="px-4 sm:px-6 py-16 text-center">
          <p className="text-gray-500">
            No items match '{bookStore.searchQuery}'
          </p>
        </div>
      ) : (
        <div className="px-4 sm:px-6 py-16 text-center">
          <p className="text-gray-500">No items in your library</p>
        </div>
      )}
    </div>
  );
});
