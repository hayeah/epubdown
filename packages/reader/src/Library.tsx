import { observer } from "mobx-react-lite";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useDocumentTitle } from "./lib/useDocumentTitle";
import { AddToCollectionModal } from "./collection/AddToCollectionModal";
import { ErrorFlash } from "./components/ErrorFlash";
import { OpenOnDrop } from "./components/OpenOnDrop";
import { BookList, SearchBar } from "./library/index";
import { useRootStore } from "./stores/RootStore";
import { useBookLibraryStore, useCollectionStore } from "./stores/RootStore";

// Helper to check if file is markdown/image
const isMarkdownFile = (f: File) => {
  const ext = f.name.toLowerCase().split(".").pop();
  return ext === "md" || ext === "markdown" || ext === "mdx" || ext === "txt";
};

const isImageFile = (f: File) => {
  const ext = f.name.toLowerCase().split(".").pop();
  return ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"].includes(
    ext ?? "",
  );
};

export const Library = observer(() => {
  const rootStore = useRootStore();
  const store = useBookLibraryStore();
  const collectionStore = useCollectionStore();
  const [, navigate] = useLocation();

  useDocumentTitle("My Library");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [pendingMarkdownFiles, setPendingMarkdownFiles] = useState<File[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (files: File[]) => {
    // Separate files by type
    const bookFiles = files.filter(
      (f) =>
        f.name.toLowerCase().endsWith(".epub") ||
        f.name.toLowerCase().endsWith(".pdf"),
    );
    const markdownFiles = files.filter(
      (f) => isMarkdownFile(f) || isImageFile(f),
    );

    // Handle book files normally
    if (bookFiles.length > 0) {
      store.handleFiles(bookFiles);
    }

    // Show collection modal for markdown files
    if (markdownFiles.length > 0) {
      setPendingMarkdownFiles(markdownFiles);
      setShowCollectionModal(true);
    }
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

  const handleChooseFolder = async () => {
    // Use modern File System Access API if available
    if ("showDirectoryPicker" in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: "read",
        });

        const files: File[] = [];

        // Recursively read all files from directory
        async function readDirectory(dirHandle: any, path = "") {
          for await (const entry of dirHandle.values()) {
            const entryPath = path ? `${path}/${entry.name}` : entry.name;

            if (entry.kind === "file") {
              const file = await entry.getFile();
              // Only include markdown and image files
              if (isMarkdownFile(file) || isImageFile(file)) {
                // Create a new File with the full path
                const fileWithPath = new File([file], entryPath, {
                  type: file.type,
                  lastModified: file.lastModified,
                });
                files.push(fileWithPath);
              }
            } else if (entry.kind === "directory") {
              // Recursively read subdirectories
              await readDirectory(entry, entryPath);
            }
          }
        }

        await readDirectory(dirHandle);

        if (files.length > 0) {
          setPendingMarkdownFiles(files);
          setShowCollectionModal(true);
          handleCloseModal();
        } else {
          alert(
            `No markdown or image files found in the selected folder.\n\nSupported formats:\n- Markdown: .md, .markdown, .mdx, .txt\n- Images: .png, .jpg, .jpeg, .gif, .svg, .webp, .bmp`,
          );
        }
      } catch (err) {
        // User cancelled or error occurred
        if ((err as Error).name !== "AbortError") {
          console.error("Error reading directory:", err);
        }
      }
    } else {
      // Fallback to old input method
      folderInputRef.current?.click();
    }
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      // Filter for markdown and image files only
      const markdownAndImageFiles = fileArray.filter(
        (f) => isMarkdownFile(f) || isImageFile(f),
      );

      if (markdownAndImageFiles.length > 0) {
        setPendingMarkdownFiles(markdownAndImageFiles);
        setShowCollectionModal(true);
        handleCloseModal();
      } else {
        // No valid files found
        alert(
          `No markdown or image files found in the selected folder.\n\nSupported formats:\n- Markdown: .md, .markdown, .txt\n- Images: .png, .jpg, .jpeg, .gif, .svg, .webp, .bmp`,
        );
      }
    }
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

  const handleCollectionModalClose = () => {
    setShowCollectionModal(false);
    setPendingMarkdownFiles([]);
  };

  const handleCollectionModalSuccess = () => {
    setShowCollectionModal(false);
    setPendingMarkdownFiles([]);
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
              Upload Files
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
          <button
            type="button"
            onClick={handleChooseFolder}
            className="w-full px-4 py-3 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-150"
          >
            Choose Folder (Markdown & Images)
          </button>
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error - webkitdirectory is not in the type definition but is supported by browsers
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFolderSelect}
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

  // Empty state - check both books and collections
  const hasItems =
    store.books.length > 0 || collectionStore.collections.length > 0;
  if (!hasItems && !store.searchQuery && !store.isLoading) {
    return (
      <>
        <OpenOnDrop
          onDrop={handleDrop}
          overlayText="Drop files to upload"
          acceptMarkdown
        >
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center space-y-4">
              <p className="text-gray-500 text-lg">
                Drop EPUB, PDF, or Markdown files here
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
        {showCollectionModal && (
          <AddToCollectionModal
            files={pendingMarkdownFiles}
            collectionStore={collectionStore}
            onClose={handleCollectionModalClose}
            onSuccess={handleCollectionModalSuccess}
          />
        )}
      </>
    );
  }

  return (
    <>
      <OpenOnDrop
        onDrop={handleDrop}
        overlayText="Drop files to upload"
        acceptMarkdown
      >
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

      {/* Collection Modal */}
      {showCollectionModal && (
        <AddToCollectionModal
          files={pendingMarkdownFiles}
          collectionStore={collectionStore}
          onClose={handleCollectionModalClose}
          onSuccess={handleCollectionModalSuccess}
        />
      )}
    </>
  );
});
