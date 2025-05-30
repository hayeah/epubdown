import { observer } from "mobx-react-lite";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  EPubResolverContext,
  createImageDataUrl,
  detectImageMimeType,
  loadImageData,
  resolveFootnoteContent,
  useEPubResolver,
} from "./MarkdownConverter";
import { useResourceStore } from "./stores/RootStore";

// Image component with viewport detection and lazy loading
export interface ImageProps {
  href: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
  className?: string;
}

export const Image: React.FC<ImageProps> = observer(
  ({ href, alt = "", title, width, height, className }) => {
    const { resolver } = useEPubResolver();
    const resourceStore = useResourceStore();
    const [isInView, setIsInView] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Get cached data from store
    const imageSrc = resourceStore.getImage(resolver, href);
    const isLoading = resourceStore.isLoading(resolver, href);
    const error = resourceStore.getError(resolver, href);
    const hasError = !!error;

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
      if (!isInView || imageSrc || isLoading) return;

      resourceStore.loadImage(resolver, href);
    }, [isInView, href, resolver, imageSrc, isLoading, resourceStore]);

    const handleImageError = useCallback(
      (error: Error) => {
        console.error("img on error:", href, error);
      },
      [href],
    );

    // Placeholder dimensions
    const placeholderStyle: React.CSSProperties = {
      width: width || "auto",
      height: height || "200px",
      backgroundColor: "#f0f0f0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "1px dashed #ccc",
      borderRadius: "4px",
      color: "#666",
      fontSize: "14px",
    };

    if (hasError) {
      return (
        <div style={placeholderStyle} className={className}>
          Failed to load image: {href}
        </div>
      );
    }

    if (isLoading || !imageSrc) {
      return (
        <div ref={imgRef} style={placeholderStyle} className={className}>
          {isLoading ? "Loading image..." : "Image"}
        </div>
      );
    }

    return (
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        title={title}
        width={width}
        height={height}
        className={className}
        onError={handleImageError}
        style={{ maxWidth: "100%", height: "auto" }}
      />
    );
  },
);

// Footnote component with hover popover
export interface FootnoteProps {
  href: string;
  id?: string;
  children: React.ReactNode;
  className?: string;
}

export const Footnote: React.FC<FootnoteProps> = observer(
  ({ href, id, children, className }) => {
    const { resolver } = useEPubResolver();
    const resourceStore = useResourceStore();
    const [isPopoverVisible, setIsPopoverVisible] = useState(false);
    const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
    const footnoteRef = useRef<HTMLSpanElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const loadTimeoutRef = useRef<NodeJS.Timeout>();

    // Get cached data from store
    const footnoteContent = resourceStore.getFootnote(resolver, href);
    const isLoading = resourceStore.isLoading(resolver, href);

    // Load footnote content
    const loadFootnoteContent = useCallback(async () => {
      if (footnoteContent || isLoading) return;

      resourceStore.loadFootnote(resolver, href);
    }, [footnoteContent, isLoading, resolver, href, resourceStore]);

    // Calculate popover position
    const updatePopoverPosition = useCallback((event: React.MouseEvent) => {
      if (!footnoteRef.current) return;

      const rect = footnoteRef.current.getBoundingClientRect();
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;

      setPopoverPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + scrollTop - 10, // Position above the footnote
      });
    }, []);

    const handleMouseEnter = useCallback(
      (event: React.MouseEvent) => {
        // Delay showing popover to avoid flickering
        loadTimeoutRef.current = setTimeout(() => {
          updatePopoverPosition(event);
          setIsPopoverVisible(true);
          loadFootnoteContent();
        }, 300);
      },
      [updatePopoverPosition, loadFootnoteContent],
    );

    const handleMouseLeave = useCallback(() => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      setIsPopoverVisible(false);
    }, []);

    // Handle click for mobile/accessibility
    const handleClick = useCallback(
      (event: React.MouseEvent) => {
        event.preventDefault();
        if (!isPopoverVisible) {
          updatePopoverPosition(event);
          setIsPopoverVisible(true);
          loadFootnoteContent();
        } else {
          setIsPopoverVisible(false);
        }
      },
      [isPopoverVisible, updatePopoverPosition, loadFootnoteContent],
    );

    useEffect(() => {
      return () => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
        }
      };
    }, []);

    const popoverStyle: React.CSSProperties = {
      position: "absolute",
      left: `${popoverPosition.x}px`,
      top: `${popoverPosition.y}px`,
      transform: "translateX(-50%) translateY(-100%)",
      backgroundColor: "white",
      border: "1px solid #ccc",
      borderRadius: "6px",
      padding: "12px",
      maxWidth: "300px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      zIndex: 1000,
      fontSize: "14px",
      lineHeight: "1.4",
      color: "#333",
      display: isPopoverVisible ? "block" : "none",
    };

    return (
      <>
        <button
          ref={footnoteRef}
          type="button"
          className={`footnote-link ${className || ""}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick();
            }
          }}
          style={{
            color: "#0066cc",
            cursor: "pointer",
            textDecoration: "underline",
            fontSize: "0.9em",
            fontWeight: "bold",
            borderRadius: "2px",
            padding: "1px 2px",
            backgroundColor: "rgba(0, 102, 204, 0.1)",
            border: "none",
            font: "inherit",
            lineHeight: "inherit",
          }}
          aria-describedby={id ? `footnote-${id}` : undefined}
        >
          {children}
        </button>

        {isPopoverVisible && (
          <div
            ref={popoverRef}
            style={popoverStyle}
            id={id ? `footnote-${id}` : undefined}
            role="tooltip"
            aria-live="polite"
          >
            {isLoading ? (
              <div style={{ color: "#666", fontStyle: "italic" }}>
                Loading...
              </div>
            ) : (
              <div>{footnoteContent}</div>
            )}
            {/* Arrow pointing down */}
            <div
              style={{
                position: "absolute",
                bottom: "-6px",
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "6px solid white",
              }}
            />
          </div>
        )}
      </>
    );
  },
);

// Provider component to inject resolver context
export interface EPubResolverProviderProps {
  resolver: any; // XMLFile from your EPub system
  children: React.ReactNode;
}

export const EPubResolverProvider: React.FC<EPubResolverProviderProps> = ({
  resolver,
  children,
}) => {
  const contextValue = {
    resolver,
  };

  return (
    <EPubResolverContext.Provider value={contextValue}>
      {children}
    </EPubResolverContext.Provider>
  );
};
