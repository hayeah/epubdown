import { Star, Trash2, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

// Mock data for books with more realistic metadata
const mockBooks = [
  {
    id: 1,
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    size: "1.2 MB",
    dateAdded: "2024-12-01",
    isPinned: true,
    lastOpened: "2024-12-03",
    progress: 75,
  },
  {
    id: 2,
    title: "To Kill a Mockingbird",
    author: "Harper Lee",
    size: "2.1 MB",
    dateAdded: "2024-11-28",
    isPinned: true,
    lastOpened: "2024-12-02",
    progress: 45,
  },
  {
    id: 3,
    title: "1984",
    author: "George Orwell",
    size: "1.8 MB",
    dateAdded: "2024-11-25",
    isPinned: false,
    lastOpened: "2024-11-30",
    progress: 100,
  },
  {
    id: 4,
    title: "Pride and Prejudice",
    author: "Jane Austen",
    size: "1.5 MB",
    dateAdded: "2024-11-20",
    isPinned: false,
    lastOpened: null,
    progress: 0,
  },
  {
    id: 5,
    title: "The Catcher in the Rye",
    author: "J.D. Salinger",
    size: "0.9 MB",
    dateAdded: "2024-11-18",
    isPinned: false,
    lastOpened: "2024-11-20",
    progress: 30,
  },
  {
    id: 6,
    title: "Brave New World",
    author: "Aldous Huxley",
    size: "1.3 MB",
    dateAdded: "2024-11-15",
    isPinned: false,
    lastOpened: null,
    progress: 0,
  },
  {
    id: 7,
    title: "The Lord of the Rings: The Fellowship of the Ring",
    author: "J.R.R. Tolkien",
    size: "3.2 MB",
    dateAdded: "2024-11-10",
    isPinned: false,
    lastOpened: "2024-11-15",
    progress: 15,
  },
  {
    id: 8,
    title: "Harry Potter and the Philosopher's Stone",
    author: "J.K. Rowling",
    size: "2.4 MB",
    dateAdded: "2024-11-08",
    isPinned: false,
    lastOpened: "2024-11-10",
    progress: 60,
  },
  {
    id: 9,
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    size: "1.7 MB",
    dateAdded: "2024-11-05",
    isPinned: false,
    lastOpened: null,
    progress: 0,
  },
  {
    id: 10,
    title: "Animal Farm",
    author: "George Orwell",
    size: "0.8 MB",
    dateAdded: "2024-11-01",
    isPinned: false,
    lastOpened: "2024-11-02",
    progress: 100,
  },
  {
    id: 11,
    title: "The Chronicles of Narnia: The Lion, the Witch and the Wardrobe",
    author: "C.S. Lewis",
    size: "1.9 MB",
    dateAdded: "2024-10-28",
    isPinned: false,
    lastOpened: null,
    progress: 0,
  },
  {
    id: 12,
    title: "Fahrenheit 451",
    author: "Ray Bradbury",
    size: "1.1 MB",
    dateAdded: "2024-10-25",
    isPinned: false,
    lastOpened: "2024-10-26",
    progress: 25,
  },
  {
    id: 13,
    title: "Jane Eyre",
    author: "Charlotte Brontë",
    size: "2.0 MB",
    dateAdded: "2024-10-20",
    isPinned: false,
    lastOpened: null,
    progress: 0,
  },
  {
    id: 14,
    title: "Wuthering Heights",
    author: "Emily Brontë",
    size: "1.6 MB",
    dateAdded: "2024-10-15",
    isPinned: false,
    lastOpened: "2024-10-18",
    progress: 50,
  },
  {
    id: 15,
    title: "The Picture of Dorian Gray",
    author: "Oscar Wilde",
    size: "1.4 MB",
    dateAdded: "2024-10-10",
    isPinned: false,
    lastOpened: "2024-10-12",
    progress: 80,
  },
];

interface Book {
  id: number;
  title: string;
  author: string;
  size: string;
  dateAdded: string;
  isPinned: boolean;
  lastOpened: string | null;
  progress: number;
}

// Book row component with dense design
const BookRow: React.FC<{
  book: Book;
  onTogglePin: (id: number) => void;
  onDelete: (id: number) => void;
  searchQuery: string;
  isSelected?: boolean;
  onClick: () => void;
}> = ({ book, onTogglePin, onDelete, searchQuery, isSelected, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Highlight matching text
  const highlightText = (text: string) => {
    if (!searchQuery) return text;
    const regex = new RegExp(`(${searchQuery})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        // biome-ignore lint/suspicious/noArrayIndexKey: This is safe since parts array is stable
        <span key={`${part}-${i}`} className="bg-yellow-300 font-medium">
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: Complex row component needs div for layout
    <div
      role="button"
      tabIndex={0}
      className={`
        flex items-center px-6 h-10 text-sm
        ${isSelected ? "bg-blue-50 border-l-2 border-blue-500" : ""}
        ${!isSelected && isHovered ? "bg-gray-50" : ""}
        border-b border-gray-100 cursor-pointer
        transition-colors duration-100
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Star icon - always visible on left */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin(book.id);
        }}
        className="p-1 -ml-1 mr-2 hover:bg-gray-200 rounded transition-colors"
        aria-label={book.isPinned ? "Unpin book" : "Pin book"}
      >
        <Star
          className={`w-4 h-4 ${
            book.isPinned
              ? "text-yellow-500 fill-yellow-500"
              : "text-gray-300 hover:text-gray-500"
          }`}
        />
      </button>

      {/* Title and Author */}
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-gray-900 truncate">
            {highlightText(book.title)}
          </span>
          <span className="text-gray-500 text-xs truncate">
            {highlightText(book.author)}
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>{book.size}</span>
        <span>{book.lastOpened || book.dateAdded}</span>
      </div>

      {/* Delete action - only visible on hover */}
      <div
        className={`
        flex items-center ml-3 transition-opacity duration-150
        ${isHovered ? "opacity-100" : "opacity-0"}
      `}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(book.id);
          }}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          aria-label="Delete book"
        >
          <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
        </button>
      </div>
    </div>
  );
};

// Main component
export default function LibraryPrototype() {
  const [books, setBooks] = useState<Book[]>(mockBooks);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter books based on search
  const filteredBooks = books.filter(
    (book) =>
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Separate pinned and regular books
  const pinnedBooks = filteredBooks.filter((book) => book.isPinned);
  const regularBooks = filteredBooks.filter((book) => !book.isPinned);

  // For the library section, show all books
  const allBooksForLibrary = filteredBooks;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // Enter to open
      if (e.key === "Enter" && selectedBookId) {
        console.log("Opening book:", selectedBookId);
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selectedBookId]);

  const handleTogglePin = (id: number) => {
    setBooks(
      books.map((book) =>
        book.id === id ? { ...book, isPinned: !book.isPinned } : book,
      ),
    );
  };

  const handleDelete = (id: number) => {
    setBooks(books.filter((book) => book.id !== id));
    if (selectedBookId === id) {
      setSelectedBookId(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only set dragging to false if we're leaving the entire window
    if (e.relatedTarget === null) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Simulate upload progress
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev === null || prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setUploadProgress(null), 1000);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Simulate upload
      setUploadProgress(0);
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev === null || prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setUploadProgress(null), 1000);
            return 100;
          }
          return prev + 10;
        });
      }, 200);
    }
  };

  if (books.length === 0 && searchQuery === "") {
    // Empty state
    return (
      <div
        className="min-h-screen bg-gray-50 flex items-center justify-center"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-center">
          <p className="text-gray-500 text-lg">
            Drop EPUB files here or click Upload
          </p>
        </div>

        {isDragging && (
          <div className="fixed inset-0 bg-blue-50 bg-opacity-95 flex items-center justify-center z-50">
            <div className="bg-white p-12 rounded-lg shadow-2xl border-2 border-blue-200">
              <p className="text-xl text-blue-600">Drop files to upload</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900 whitespace-nowrap">
            My Library
          </h1>

          <div className="flex-1">
            <div className="relative max-w-md mx-auto">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search titles and authors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white
                         transition-all duration-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg 
                     hover:bg-blue-700 transition-colors duration-150 shadow-sm whitespace-nowrap"
          >
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".epub"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Upload progress */}
        {uploadProgress !== null && (
          <div className="bg-blue-50/80 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto px-6 py-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-blue-700">
                  Uploading...
                </span>
                <div className="flex-1 bg-blue-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-blue-700 tabular-nums">
                  {uploadProgress}%
                </span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <div
        className="max-w-4xl mx-auto mt-2 mb-8 relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {searchQuery ? (
          // Search results - single merged list
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-6 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Search Results ({filteredBooks.length})
              </span>
            </div>
            {filteredBooks.length > 0 ? (
              [...filteredBooks]
                .sort((a, b) => {
                  // Pinned items first
                  if (a.isPinned && !b.isPinned) return -1;
                  if (!a.isPinned && b.isPinned) return 1;
                  return 0;
                })
                .map((book) => (
                  <BookRow
                    key={book.id}
                    book={book}
                    onTogglePin={handleTogglePin}
                    onDelete={handleDelete}
                    searchQuery={searchQuery}
                    isSelected={selectedBookId === book.id}
                    onClick={() => setSelectedBookId(book.id)}
                  />
                ))
            ) : (
              <div className="px-6 py-16 text-center">
                <p className="text-gray-500">No books match '{searchQuery}'</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Pinned section */}
            {pinnedBooks.length > 0 && (
              <div className="bg-white shadow-sm rounded-lg overflow-hidden mb-4">
                <div className="px-6 py-2 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Pinned ({pinnedBooks.length})
                  </span>
                </div>
                {pinnedBooks.map((book) => (
                  <BookRow
                    key={book.id}
                    book={book}
                    onTogglePin={handleTogglePin}
                    onDelete={handleDelete}
                    searchQuery={searchQuery}
                    isSelected={selectedBookId === book.id}
                    onClick={() => setSelectedBookId(book.id)}
                  />
                ))}
              </div>
            )}

            {/* Regular books */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-6 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Library ({allBooksForLibrary.length})
                </span>
              </div>
              {allBooksForLibrary.map((book) => (
                <BookRow
                  key={book.id}
                  book={book}
                  onTogglePin={handleTogglePin}
                  onDelete={handleDelete}
                  searchQuery={searchQuery}
                  isSelected={selectedBookId === book.id}
                  onClick={() => setSelectedBookId(book.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Drag overlay - contained within content area */}
        {isDragging && (
          <div className="absolute inset-0 bg-blue-50 bg-opacity-95 flex items-center justify-center z-10 rounded-lg">
            <div className="bg-white p-12 rounded-lg shadow-2xl border-2 border-blue-200">
              <p className="text-xl text-blue-600">Drop files to upload</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
