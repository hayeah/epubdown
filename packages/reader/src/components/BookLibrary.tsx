import { Plus } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useDropzone } from "react-dropzone";
import type { BookMetadata } from "../lib/BookDatabase";
import { useBookLibraryStore } from "../stores/RootStore";

interface BookLibraryProps {
  onOpenBook: (bookId: string) => void;
}

export const BookLibrary = observer(({ onOpenBook }: BookLibraryProps) => {
  const bookLibraryStore = useBookLibraryStore();
  const { books, isLoading } = bookLibraryStore;

  const handleFiles = async (files: File[]) => {
    const epubFiles = files.filter((file) =>
      file.name.toLowerCase().endsWith(".epub"),
    );

    if (epubFiles.length === 0) {
      alert("Please select or drop EPUB files only");
      return;
    }

    for (const file of epubFiles) {
      try {
        await bookLibraryStore.addBook(file);
      } catch (error) {
        console.error("Failed to add book:", error);
        alert(`Failed to add "${file.name}": ${(error as Error).message}`);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFiles,
    accept: {
      "application/epub+zip": [".epub"],
    },
    multiple: true,
  });

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
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <input {...getInputProps()} />
          <Plus className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          {isDragActive ? (
            <p className="text-blue-600">Drop EPUB files here...</p>
          ) : (
            <>
              <p className="text-gray-600">
                Click to select or drag and drop EPUB files
              </p>
              <p className="text-sm text-gray-500 mt-2">
                You can upload multiple files at once
              </p>
            </>
          )}
        </div>
      </div>

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
          <p className="text-gray-600 text-sm mb-2">{book.filename}</p>
        </button>
        <div className="text-xs text-gray-500 space-y-1">
          <p>{formatFileSize(book.fileSize)}</p>
          <p>Added: {formatDate(book.createdAt)}</p>
          {book.lastOpenedAt && (
            <p>Last opened: {formatDate(book.lastOpenedAt)}</p>
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
