import { observer } from "mobx-react-lite";
import type React from "react";
import { useEffect, useRef, useState } from "react";
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
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (files: File[]) => {
    store.handleFiles(files);
  };

  const handleShowUploadModal = () => {
    setShowUploadModal(true);
  };

  const handleCloseModal = () => {
    setShowUploadModal(false);
    setUrlInput("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      store.handleFiles(Array.from(files));
      handleCloseModal();
    }
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      navigate(`/addBook?url=${encodeURIComponent(urlInput.trim())}`);
      handleCloseModal();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCloseModal();
    }
  };

  const uploadModal = showUploadModal ? (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleCloseModal}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900">Add Book</h2>

        {/* File Upload Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <span className="text-sm font-medium text-gray-700">
              Upload File
            </span>
          </div>
          <button
            type="button"
            onClick={handleChooseFile}
            className="w-full px-4 py-3 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-150"
          >
            Choose EPUB or PDF File
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

        {/* URL Section */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <span className="text-sm font-medium text-gray-700">
              Download from URL
            </span>
          </div>
          <form onSubmit={handleUrlSubmit} className="space-y-3">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/book.epub"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <button
              type="submit"
              disabled={!urlInput.trim()}
              className="w-full px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Download from URL
            </button>
          </form>
        </div>

        {/* Cancel Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleCloseModal}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-150"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // Setup event bindings for library view
  useEffect(() => {
    const dispose = store.setupBindings();
    return dispose;
  }, [store]);

  // Empty state
  if (store.books.length === 0 && !store.searchQuery && !store.isLoading) {
    return (
      <>
        <OpenOnDrop onDrop={handleDrop} overlayText="Drop files to upload">
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center space-y-4">
              <p className="text-gray-500 text-lg">
                Drop EPUB or PDF files here or add a book
              </p>
              <button
                type="button"
                onClick={handleShowUploadModal}
                className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-150 shadow-sm"
              >
                Upload
              </button>
            </div>
          </div>
        </OpenOnDrop>
        {uploadModal}
      </>
    );
  }

  return (
    <>
      <OpenOnDrop onDrop={handleDrop} overlayText="Drop files to upload">
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

              <div className="flex w-full lg:w-auto lg:justify-end">
                <button
                  type="button"
                  onClick={handleShowUploadModal}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-150 shadow-sm text-center"
                >
                  Upload
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
      </OpenOnDrop>

      {/* Upload Modal */}
      {uploadModal}
    </>
  );
});
