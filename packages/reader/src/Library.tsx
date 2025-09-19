import { observer } from "mobx-react-lite";
import type React from "react";
import { useEffect, useRef } from "react";
import { ErrorFlash } from "./components/ErrorFlash";
import { OpenOnDrop } from "./components/OpenOnDrop";
import { BookList, SearchBar } from "./library/index";
import { useRootStore } from "./stores/RootStore";
import { useBookLibraryStore } from "./stores/RootStore";

export const Library = observer(() => {
  const rootStore = useRootStore();
  const store = useBookLibraryStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (files: File[]) => {
    store.handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      store.handleFiles(Array.from(files));
    }
  };

  // Setup event bindings for library view
  useEffect(() => {
    const dispose = store.setupBindings();
    return dispose;
  }, [store]);

  // Empty state
  if (store.books.length === 0 && !store.searchQuery && !store.isLoading) {
    return (
      <OpenOnDrop onDrop={handleDrop} overlayText="Drop files to upload">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-lg">
              Drop EPUB or PDF files here or click Upload
            </p>
          </div>
        </div>
      </OpenOnDrop>
    );
  }

  return (
    <OpenOnDrop onDrop={handleDrop} overlayText="Drop files to upload">
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
              accept=".epub,.pdf"
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
        <div className="max-w-4xl mx-auto mt-2 mb-8 relative">
          <BookList />
        </div>

        {/* Error Flash */}
        {store.uploadErrors.length > 0 && (
          <ErrorFlash
            errors={store.uploadErrors}
            onDismiss={() => store.dismissAllUploadErrors()}
            onDismissError={(id) => store.dismissUploadError(id)}
          />
        )}
      </div>
    </OpenOnDrop>
  );
});
