import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ErrorFlash } from "./components/ErrorFlash";
import { OpenOnDrop } from "./components/OpenOnDrop";
import { BookList, SearchBar } from "./library/index";
import { useRootStore } from "./stores/RootStore";
import { useBookLibraryStore } from "./stores/RootStore";

export const Library = observer(() => {
  const rootStore = useRootStore();
  const store = useBookLibraryStore();
  const [, navigate] = useLocation();
  const [showUrlPrompt, setShowUrlPrompt] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const handleDrop = (files: File[]) => {
    store.handleFiles(files);
  };

  const handleAddFromUrl = () => {
    setShowUrlPrompt(true);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      navigate(`/addBook?url=${encodeURIComponent(urlInput.trim())}`);
    }
  };

  const handleCancelUrl = () => {
    setShowUrlPrompt(false);
    setUrlInput("");
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
        {({ open }) => (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center space-y-4">
              <p className="text-gray-500 text-lg">
                Drop EPUB files here or add a book
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={open}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-150 shadow-sm"
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={handleAddFromUrl}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-150 shadow-sm"
                >
                  Add from URL
                </button>
              </div>
            </div>
          </div>
        )}
      </OpenOnDrop>
    );
  }

  return (
    <>
      <OpenOnDrop onDrop={handleDrop} overlayText="Drop files to upload">
        {({ open }) => (
          <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur supports-[backdrop-filter]:bg-gray-50/80">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
                <h1 className="text-xl font-semibold text-gray-900">
                  My Library
                </h1>

                <div className="w-full lg:flex-1">
                  <SearchBar
                    value={store.searchQuery}
                    onChange={(query: string) => store.searchBooks(query)}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 lg:gap-3 w-full lg:w-auto lg:justify-end">
                  <button
                    type="button"
                    onClick={handleAddFromUrl}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-150 shadow-sm text-center"
                  >
                    Add from URL
                  </button>

                  <button
                    type="button"
                    onClick={open}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-150 shadow-sm text-center"
                  >
                    Upload File
                  </button>
                </div>
              </div>

              {/* Upload progress */}
              {store.uploadProgress !== null && (
                <div className="bg-blue-50/80 backdrop-blur-sm">
                  <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
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
            <div className="max-w-4xl mx-auto mt-3 mb-8 relative px-4 sm:px-6">
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
        )}
      </OpenOnDrop>

      {/* URL Prompt Modal */}
      {showUrlPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Add book from URL
            </h2>
            <form onSubmit={handleUrlSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="url-input"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  EPUB URL
                </label>
                <input
                  id="url-input"
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/book.epub"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCancelUrl}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-150"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!urlInput.trim()}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Download
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
});
