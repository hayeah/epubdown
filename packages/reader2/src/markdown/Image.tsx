import type { EPub } from "@epubdown/core";
import { AlertCircle } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useEffect, useState } from "react";
import { uint8ArrayToBase64 } from "../lib/base64";
import { useReaderStore } from "../stores/RootStore";

function isExternalURL(src: string): boolean {
  return /^(https?:|data:|blob:)/i.test(src);
}

async function getImageFromArchive(epub: EPub | null, src: string): Promise<string> {
  if (!src) throw new Error("Empty image src");
  if (isExternalURL(src)) return src;
  if (!epub) throw new Error("Archive not loaded");

  const decoded = decodeURIComponent(src);
  const bytes = await epub.resolver.readRaw(decoded);
  if (!bytes) throw new Error(`Image not found: ${decoded}`);

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

  return `data:${mime};base64,${uint8ArrayToBase64(bytes)}`;
}

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
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      let cancelled = false;
      getImageFromArchive(readerStore.epub, src)
        .then((result) => {
          if (!cancelled) setImageSrc(result);
        })
        .catch((err) => {
          if (!cancelled) setError(err.message);
        });
      return () => {
        cancelled = true;
      };
    }, [readerStore.epub, src]);

    if (error) {
      return (
        <span
          className={`inline-flex flex-col items-center justify-center bg-gray-100 border border-dashed border-gray-300 rounded text-red-600 text-sm gap-2 p-4 ${className || ""}`}
        >
          <AlertCircle className="w-6 h-6" />
          <span className="text-xs text-gray-500">{src}</span>
        </span>
      );
    }

    if (!imageSrc) return null;

    return (
      <img
        src={imageSrc}
        alt={alt}
        title={title}
        width={width}
        height={height}
        className={`max-w-full h-auto ${className || ""}`}
      />
    );
  },
);
