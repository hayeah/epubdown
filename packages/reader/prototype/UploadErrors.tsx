import { AlertCircle, ChevronDown, ChevronUp, X } from "lucide-react";
import type React from "react";
import { useState } from "react";

interface UploadError {
  id: string;
  filename: string;
  error: string;
}

// Flash message component for upload errors
const ErrorFlash: React.FC<{
  errors: UploadError[];
  onDismiss: () => void;
  onDismissError: (id: string) => void;
}> = ({ errors, onDismiss, onDismissError }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxVisible = 5;
  const hasMore = errors.length > maxVisible;
  const visibleErrors = isExpanded ? errors : errors.slice(0, maxVisible);

  return (
    <div className="fixed top-4 right-4 max-w-md w-full z-50 animate-slide-in">
      <div className="bg-red-50 border border-red-200 rounded-lg shadow-lg">
        {/* Header */}
        <div className="px-4 py-3 flex items-start justify-between border-b border-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Upload Failed</h3>
              <p className="text-sm text-red-700 mt-0.5">
                {errors.length} {errors.length === 1 ? "file" : "files"} could
                not be uploaded
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 hover:bg-red-100 rounded transition-colors"
            aria-label="Dismiss all errors"
          >
            <X className="w-4 h-4 text-red-600" />
          </button>
        </div>

        {/* Error list */}
        <div className="max-h-80 overflow-y-auto">
          {visibleErrors.map((error) => (
            <div
              key={error.id}
              className="px-4 py-3 border-b border-red-100 last:border-b-0 group hover:bg-red-100/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {error.filename}
                  </p>
                  <p className="text-sm text-red-600 mt-0.5">{error.error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDismissError(error.id)}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-200 rounded transition-all"
                  aria-label={`Dismiss error for ${error.filename}`}
                >
                  <X className="w-3.5 h-3.5 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Expand/Collapse button */}
        {hasMore && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-2 bg-red-100 hover:bg-red-200 transition-colors flex items-center justify-center gap-2 text-sm font-medium text-red-700 border-t border-red-200"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show {errors.length - maxVisible} more
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

// Main prototype component
export const UploadErrorsPrototype: React.FC = () => {
  const [errors, setErrors] = useState<UploadError[]>([]);
  const [simulationCount, setSimulationCount] = useState(3);

  // Simulate upload errors
  const simulateErrors = () => {
    const errorMessages = [
      "File is not a valid EPUB format",
      "File size exceeds 100MB limit",
      "Corrupted file structure",
      "Missing required metadata",
      "Unsupported EPUB version",
      "Failed to parse table of contents",
      "Invalid mimetype in container",
      "Missing OPF manifest",
      "DRM protected file",
      "Network timeout during upload",
    ];

    const filenames = [
      "War and Peace.epub",
      "The Great Gatsby.epub",
      "1984.epub",
      "Pride and Prejudice.epub",
      "To Kill a Mockingbird.epub",
      "The Catcher in the Rye.epub",
      "Animal Farm.epub",
      "Lord of the Flies.epub",
      "The Hobbit.epub",
      "Harry Potter.epub",
    ];

    const newErrors: UploadError[] = [];
    for (let i = 0; i < simulationCount; i++) {
      newErrors.push({
        id: `error-${Date.now()}-${i}`,
        filename: filenames[i % filenames.length] ?? "Unknown file",
        error: errorMessages[i % errorMessages.length] ?? "Unknown error",
      });
    }
    setErrors(newErrors);
  };

  const handleDismissAll = () => {
    setErrors([]);
  };

  const handleDismissError = (id: string) => {
    setErrors(errors.filter((e) => e.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Upload Errors Prototype
        </h1>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Simulation Controls</h2>

          <div className="flex items-center gap-4 mb-4">
            <label
              htmlFor="error-count"
              className="text-sm font-medium text-gray-700"
            >
              Number of errors to simulate:
            </label>
            <input
              id="error-count"
              type="number"
              min="1"
              max="10"
              value={simulationCount}
              onChange={(e) => setSimulationCount(Number(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={simulateErrors}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Simulate Upload Errors
          </button>
        </div>

        {/* Demo content */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Library View</h2>
          <p className="text-gray-600">
            This is where the library content would be. The error flash appears
            in the top-right corner when there are upload failures.
          </p>

          <div className="mt-6 space-y-2">
            {["Book 1", "Book 2", "Book 3"].map((book) => (
              <div
                key={book}
                className="p-3 bg-gray-50 rounded border border-gray-200"
              >
                {book}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Error Flash */}
      {errors.length > 0 && (
        <ErrorFlash
          errors={errors}
          onDismiss={handleDismissAll}
          onDismissError={handleDismissError}
        />
      )}

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};
