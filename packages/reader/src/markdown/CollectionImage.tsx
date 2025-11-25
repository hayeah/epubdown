import { AlertCircle } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { AsyncView } from "../lib/AsyncView";
import type { CollectionReaderStore } from "../stores/CollectionReaderStore";

// Helper function to check if URL is external
function isExternalUrl(src: string): boolean {
  return /^(https?:|data:|blob:)/i.test(src);
}

// Image component for collection markdown
export interface CollectionImageProps {
  src: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
  className?: string;
  readerStore: CollectionReaderStore;
}

export const CollectionImage: React.FC<CollectionImageProps> = observer(
  ({ src, alt = "", title, width, height, className, readerStore }) => {
    // Placeholder dimensions style
    const placeholderStyle: React.CSSProperties = {
      width: width || "auto",
      height: height || "200px",
    };

    return (
      <AsyncView
        onError={(err) => (
          <span
            style={{ ...placeholderStyle, display: "inline-block" }}
            className={`bg-gray-100 inline-flex flex-col items-center justify-center border border-dashed border-gray-300 rounded text-red-600 text-sm gap-2 ${className || ""}`}
          >
            <AlertCircle className="w-8 h-8" />
            <span>Failed to load image</span>
            <span className="text-xs text-gray-500 px-2 text-center break-words">
              {src}
            </span>
          </span>
        )}
      >
        {async () => {
          // Return external URLs as-is
          if (isExternalUrl(src)) {
            return (
              <img
                src={src}
                alt={alt}
                title={title}
                width={width}
                height={height}
                className={`max-w-full h-auto ${className || ""}`}
              />
            );
          }

          // Resolve relative path and get image URL from collection
          const resolvedPath = readerStore.resolveImagePath(src);
          const imageUrl = await readerStore.getImageUrl(resolvedPath);

          if (!imageUrl) {
            throw new Error(`Image not found: ${resolvedPath}`);
          }

          return (
            <img
              src={imageUrl}
              alt={alt}
              title={title}
              width={width}
              height={height}
              className={`max-w-full h-auto ${className || ""}`}
            />
          );
        }}
      </AsyncView>
    );
  },
);
