import { observer } from "mobx-react-lite";
import type React from "react";
import { useBookLibraryStore } from "../stores/RootStore";
import { BookRow } from "./BookRow";

export const BookList = observer(() => {
  const store = useBookLibraryStore();
  const handleDelete = (bookId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    if (confirm("Are you sure you want to delete this book?")) {
      store.deleteBook(bookId);
    }
  };

  const title = store.searchQuery ? "Search Results" : "Library";

  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      <div className="px-4 sm:px-6 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
          {title} ({store.books.length})
        </span>
      </div>
      {store.books.length > 0 ? (
        store.books.map((book) => (
          <BookRow
            key={book.id}
            book={book}
            onDelete={(e) => handleDelete(book.id, e)}
            searchQuery={store.searchQuery}
          />
        ))
      ) : store.searchQuery ? (
        <div className="px-4 sm:px-6 py-16 text-center">
          <p className="text-gray-500">No books match '{store.searchQuery}'</p>
        </div>
      ) : (
        <div className="px-4 sm:px-6 py-16 text-center">
          <p className="text-gray-500">No books in your library</p>
        </div>
      )}
    </div>
  );
});
