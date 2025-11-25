import { FolderPlus, Plus } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useState } from "react";
import type { CollectionStore } from "../stores/CollectionStore";

interface AddToCollectionModalProps {
  files: File[];
  collectionStore: CollectionStore;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddToCollectionModal: React.FC<AddToCollectionModalProps> =
  observer(({ files, collectionStore, onClose, onSuccess }) => {
    const [selectedCollectionId, setSelectedCollectionId] = useState<
      number | "new"
    >("new");
    const [newCollectionName, setNewCollectionName] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { collections } = collectionStore;

    const markdownFiles = files.filter((f) => {
      const ext = f.name.toLowerCase().split(".").pop();
      return (
        ext === "md" || ext === "markdown" || ext === "mdx" || ext === "txt"
      );
    });

    const imageFiles = files.filter((f) => {
      const ext = f.name.toLowerCase().split(".").pop();
      return ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"].includes(
        ext ?? "",
      );
    });

    const totalFiles = markdownFiles.length + imageFiles.length;

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsProcessing(true);

      try {
        if (selectedCollectionId === "new") {
          if (!newCollectionName.trim()) {
            setError("Please enter a collection name");
            setIsProcessing(false);
            return;
          }
          await collectionStore.createCollection(
            newCollectionName.trim(),
            files,
          );
        } else {
          const result = await collectionStore.addFilesToCollection(
            selectedCollectionId,
            files,
          );
          if (result.added === 0 && result.skipped > 0) {
            setError(
              `All ${result.skipped} files already exist in this collection`,
            );
            setIsProcessing(false);
            return;
          }
        }
        onSuccess();
      } catch (err) {
        setError((err as Error).message);
        setIsProcessing(false);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    return (
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
        onKeyDown={handleKeyDown}
      >
        <dialog
          open
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-0 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">
              Add to Collection
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Organize your markdown files into collections
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {/* File summary */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <p className="font-semibold text-gray-900">
                {totalFiles} file{totalFiles !== 1 ? "s" : ""} selected
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {markdownFiles.length} markdown, {imageFiles.length} images
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* Collection selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Collection
                </label>

                {/* New collection option */}
                <div
                  className={`border-2 rounded-xl transition-all ${
                    selectedCollectionId === "new"
                      ? "border-blue-500 bg-blue-50/50 shadow-sm"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <label className="flex items-center gap-3 p-4 cursor-pointer">
                    <input
                      type="radio"
                      name="collection"
                      value="new"
                      checked={selectedCollectionId === "new"}
                      onChange={() => setSelectedCollectionId("new")}
                      className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Plus className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-900">
                        Create new collection
                      </span>
                    </div>
                  </label>

                  {/* New collection name input */}
                  {selectedCollectionId === "new" && (
                    <div className="px-4 pb-4">
                      <input
                        type="text"
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        placeholder="Collection name"
                        autoFocus
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder:text-gray-400"
                      />
                    </div>
                  )}
                </div>

                {/* Existing collections */}
                {collections.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {collections.map((collection) => (
                      <div
                        key={collection.id}
                        className={`border-2 rounded-xl transition-all ${
                          selectedCollectionId === collection.id
                            ? "border-blue-500 bg-blue-50/50 shadow-sm"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <label className="flex items-center gap-3 p-4 cursor-pointer">
                          <input
                            type="radio"
                            name="collection"
                            value={collection.id}
                            checked={selectedCollectionId === collection.id}
                            onChange={() =>
                              setSelectedCollectionId(collection.id)
                            }
                            className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                              <FolderPlus className="w-4 h-4 text-amber-600" />
                            </div>
                            <span className="font-medium text-gray-900 truncate">
                              {collection.name}
                            </span>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                  <svg
                    className="w-5 h-5 shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </form>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isProcessing || totalFiles === 0}
              className="flex-1 px-4 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Adding...
                </span>
              ) : (
                "Add Files"
              )}
            </button>
          </div>
        </dialog>
      </div>
    );
  });
