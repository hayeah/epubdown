import { observer } from "mobx-react-lite";
import type React from "react";
import type { BookMetadata } from "../lib/BookDatabase";
import { useBookLibraryStore } from "../stores/RootStore";

interface BookLibraryProps {
  onOpenBook: (bookId: string) => void;
}

export const BookLibrary = observer(({ onOpenBook }: BookLibraryProps) => {
  const bookLibraryStore = useBookLibraryStore();
  const { books, isLoading, error } = bookLibraryStore;

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const bookId = await bookLibraryStore.addBook(file);
    if (bookId) {
      // Clear the input
      event.target.value = "";
    }
  };

  const handleDelete = async (bookId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (confirm("Are you sure you want to delete this book?")) {
      await bookLibraryStore.deleteBook(bookId);
    }
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
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">My Library</h1>

      <div className="mb-8">
        <label className="block">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 cursor-pointer transition-colors">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <p className="text-gray-600">Click to upload an EPUB file</p>
            <input
              type="file"
              accept=".epub"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </label>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      {isLoading ? (
        <div className="text-center py-8">Loading library...</div>
      ) : books.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-xl mb-2">No books in your library yet</p>
          <p>Upload an EPUB file to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onOpen={() => onOpenBook(book.id)}
              onDelete={(e) => handleDelete(book.id, e)}
              formatFileSize={formatFileSize}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}
    </div>
  );
});

interface BookCardProps {
  book: BookMetadata;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
  formatFileSize: (bytes?: number) => string;
  formatDate: (timestamp?: number) => string;
}

const BookCard = ({
  book,
  onOpen,
  onDelete,
  formatFileSize,
  formatDate,
}: BookCardProps) => {
  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <div className="p-6">
        <button
          type="button"
          onClick={onOpen}
          className="text-left w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          <h3 className="font-semibold text-lg mb-2 line-clamp-2">
            {book.title}
          </h3>
          {book.author && (
            <p className="text-gray-600 text-sm mb-2">{book.author}</p>
          )}
        </button>
        <div className="text-xs text-gray-500 space-y-1">
          {book.fileSize && <p>{formatFileSize(book.fileSize)}</p>}
          <p>Added: {formatDate(book.addedAt)}</p>
          {book.lastOpenedAt && (
            <p>Last opened: {formatDate(book.lastOpenedAt)}</p>
          )}
          {book.readingProgress !== undefined && book.readingProgress > 0 && (
            <div className="mt-2">
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${book.readingProgress * 100}%` }}
                />
              </div>
              <p className="mt-1">
                {Math.round(book.readingProgress * 100)}% read
              </p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="mt-4 text-red-600 hover:text-red-800 text-sm"
        >
          Delete
        </button>
      </div>
    </div>
  );
};
