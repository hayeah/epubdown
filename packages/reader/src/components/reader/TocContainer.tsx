import type React from "react";

export interface TocContainerProps {
  emptyMessage?: string;
  isEmpty?: boolean;
  headerTools?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Unified container for table of contents across all reader types.
 * Provides consistent layout with fixed header and scrollable content.
 */
export const TocContainer: React.FC<TocContainerProps> = ({
  emptyMessage = "No table of contents available",
  isEmpty = false,
  headerTools,
  children,
}) => {
  if (isEmpty) {
    return <div className="p-4 text-gray-500">{emptyMessage}</div>;
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Fixed header with search/tools */}
      {headerTools && (
        <div className="flex-shrink-0 bg-white border-b">{headerTools}</div>
      )}

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
};
