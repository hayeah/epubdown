import { observer } from "mobx-react-lite";
import type React from "react";
import { useRef } from "react";
import { useDropzone } from "react-dropzone";
import { BookList, SearchBar } from "./library/index";
import { useBookLibraryStore } from "./stores/RootStore";

export const Library = observer(() => {
  const store = useBookLibraryStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (files) => {
      store.setDragging(false);
      store.handleFiles(files);
    },
    onDragEnter: () => store.setDragging(true),
    onDragLeave: () => store.setDragging(false),
    accept: {
      "application/epub+zip": [".epub"],
    },
    multiple: true,
    noClick: true,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      store.handleFiles(Array.from(files));
    }
  };

  // Empty state
  if (store.books.length === 0 && !store.searchQuery && !store.isLoading) {
    return (
      <div
        className="min-h-screen bg-gray-50 flex items-center justify-center"
        {...getRootProps()}
      >
        <input {...getInputProps()} />
        <div className="text-center">
          <p className="text-gray-500 text-lg">
            Drop EPUB files here or click Upload
          </p>
        </div>

        {store.isDragging && (
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
            <SearchBar
              value={store.searchQuery}
              onChange={(query: string) => store.searchBooks(query)}
            />
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
        {store.uploadProgress !== null && (
          <div className="bg-blue-50/80 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto px-6 py-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-blue-700">
                  Uploading...
                </span>
                <div className="flex-1 bg-blue-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${store.uploadProgress}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-blue-700 tabular-nums">
                  {store.uploadProgress}%
                </span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto mt-2 mb-8 relative" {...getRootProps()}>
        <input {...getInputProps()} />

        <BookList />

        {/* Drag overlay */}
        {store.isDragging && (
          <div className="absolute inset-0 bg-blue-50 bg-opacity-95 flex items-center justify-center z-10 rounded-lg">
            <div className="bg-white p-12 rounded-lg shadow-2xl border-2 border-blue-200">
              <p className="text-xl text-blue-600">Drop files to upload</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
