import type { EPub } from "@epubdown/core";
import { AlertCircle, Loader } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useCallback } from "react";
import { uint8ArrayToBase64 } from "../lib/base64";
import { useReaderStore } from "../stores/RootStore";
import { usePromise } from "../utils/usePromise";

// Helper functions for image loading
function isExternalUrl(src: string): boolean {
  return /^(https?:|data:|blob:)/i.test(src);
}

async function getImageFromArchive(
  epub: EPub | null,
  src: string,
): Promise<string> {
  if (!src) throw new Error("Empty image src");
  if (isExternalUrl(src)) return src;
  if (!epub) throw new Error("Archive not loaded");

  const decoded = decodeURIComponent(src);
  const bytes = await epub.resolver.readRaw(decoded);
  if (!bytes) throw new Error("Image not found");

  const ext = decoded.split(".").pop()?.toLowerCase();
  const mime =
    ext === "png"
      ? "image/png"
      : ext === "gif"
        ? "image/gif"
        : ext === "webp"
          ? "image/webp"
          : ext === "svg"
            ? "image/svg+xml"
            : "image/jpeg";

  const base64 = uint8ArrayToBase64(bytes);
  return `data:${mime};base64,${base64}`;
}

// Image component that uses ReaderStore directly
export interface ImageProps {
  src: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
  className?: string;
}

export const Image: React.FC<ImageProps> = observer(
  ({ src, alt = "", title, width, height, className }) => {
    const readerStore = useReaderStore();

    // Use usePromise for clean async loading
    const {
      value: imageSrc,
      error,
      loading,
    } = usePromise(
      async (signal) => {
        return await getImageFromArchive(readerStore.epub, src);
      },
      [src, readerStore.epub]
    );

    const handleImageError = useCallback(() => {
      console.error("img on error:", src);
    }, [src]);

    // Placeholder dimensions style
    const placeholderStyle: React.CSSProperties = {
      width: width || "auto",
      height: height || "200px",
    };

    if (error) {
      return (
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
      );
    }

    if (loading) {
      return (
        <span
          style={{ ...placeholderStyle, display: "inline-block" }}
          className={`bg-gray-100 inline-flex items-center justify-center border border-dashed border-gray-300 rounded text-gray-500 ${className || ""}`}
        >
          <Loader className="w-8 h-8 animate-spin" />
        </span>
      );
    }

    return (
      <img
        src={imageSrc || ""}
        alt={alt}
        title={title}
        width={width}
        height={height}
        className={`max-w-full h-auto ${className || ""}`}
        onError={handleImageError}
      />
    );
  },
);
