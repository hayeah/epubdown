import { AlertCircle, ChevronDown, ChevronUp, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useEventSystem } from "../stores/RootStore";

export interface ErrorItem {
  id: string;
  errorMsg: string;
  errorDetail: string;
}

interface ErrorFlashProps {
  errors: ErrorItem[];
  onDismiss: () => void;
  onDismissError: (id: string) => void;
}

export const ErrorFlash: React.FC<ErrorFlashProps> = ({
  errors,
  onDismiss,
  onDismissError,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const eventSystem = useEventSystem();
  const maxVisible = 5;
  const hasMore = errors.length > maxVisible;
  const visibleErrors = isExpanded ? errors : errors.slice(0, maxVisible);

  // Register bgClick event to dismiss when clicking outside
  useEffect(() => {
    const dispose = eventSystem.register([
      {
        id: "errorFlash.dismissOnBgClick",
        event: {
          kind: "bgClick",
          shield: () => containerRef.current,
        },
        run: () => onDismiss(),
      },
    ]);

    return dispose;
  }, [eventSystem, onDismiss]);

  return (
    <div
      ref={containerRef}
      className="fixed top-4 right-4 max-w-md w-full z-50 animate-slide-in"
    >
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
                    {error.errorMsg}
                  </p>
                  <p className="text-sm text-red-600 mt-0.5">
                    {error.errorDetail}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDismissError(error.id)}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-200 rounded transition-all"
                  aria-label={`Dismiss error for ${error.errorMsg}`}
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
