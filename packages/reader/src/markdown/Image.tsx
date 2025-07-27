import { AlertCircle, ImageIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReaderStore } from "../stores/RootStore";

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
    const [isInView, setIsInView] = useState(false);
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const imgRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Intersection Observer for viewport detection
    useEffect(() => {
      if (!imgRef.current) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setIsInView(true);
              observerRef.current?.unobserve(entry.target);
            }
          }
        },
        {
          rootMargin: "50px", // Start loading 50px before entering viewport
          threshold: 0.1,
        },
      );

      observerRef.current.observe(imgRef.current);

      return () => {
        observerRef.current?.disconnect();
      };
    }, []);

    // Load image data when in view
    useEffect(() => {
      if (!isInView || imageSrc) return;

      const currentChapter = readerStore.currentChapter;
      if (!currentChapter) return;

      let cancelled = false;

      const loadImage = async () => {
        setError(null);
        try {
          // Use the store's getImage method which already handles conversion
          const dataUrl = await readerStore.getImage(currentChapter, src);

          if (!cancelled) {
            setImageSrc(dataUrl);
          }
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof Error ? err.message : "Failed to load image",
            );
          }
        }
      };

      loadImage();

      return () => {
        cancelled = true;
      };
    }, [isInView, src, imageSrc, readerStore]);

    const handleImageError = useCallback(() => {
      console.error("img on error:", src);
      setError("Failed to display image");
    }, [src]);

    // Placeholder dimensions style
    const placeholderStyle: React.CSSProperties = {
      width: width || "auto",
      height: height || "200px",
    };

    if (error) {
      return (
        <div
          style={placeholderStyle}
          className={`bg-gray-100 flex flex-col items-center justify-center border border-dashed border-gray-300 rounded text-red-600 text-sm gap-2 ${className || ""}`}
        >
          <AlertCircle className="w-8 h-8" />
          <span>Failed to load image</span>
          <span className="text-xs text-gray-500 px-2 text-center break-words">
            {src}
          </span>
        </div>
      );
    }

    if (!imageSrc) {
      return (
        <div
          ref={imgRef}
          style={placeholderStyle}
          className={`bg-gray-100 flex items-center justify-center border border-dashed border-gray-300 rounded text-gray-500 ${className || ""}`}
        >
          <ImageIcon className="w-8 h-8" />
        </div>
      );
    }

    return (
      <img
        ref={imgRef as any}
        src={imageSrc}
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
