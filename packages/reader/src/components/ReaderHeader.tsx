import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

export interface ReaderHeaderProgress {
  current: number;
  total: number;
  label?: string;
}

export interface ReaderHeaderProps {
  // Content
  title: string;
  subtitle?: string;

  // Navigation
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void | Promise<void>;
  onNext: () => void | Promise<void>;

  // Optional: Progress indicator
  progress?: ReaderHeaderProgress;

  // Optional: Sidebar toggle
  onToggleSidebar?: () => void;

  // Optional: Custom controls
  rightControls?: React.ReactNode;
  leftControls?: React.ReactNode;

  // Styling variants
  variant?: "compact" | "full";
}

export const ReaderHeader: React.FC<ReaderHeaderProps> = ({
  title,
  subtitle,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  progress,
  onToggleSidebar,
  rightControls,
  leftControls,
  variant = "full",
}) => {
  const [isSticky, setIsSticky] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Detect when navigation becomes sticky using IntersectionObserver
  useEffect(() => {
    const sentinel = document.createElement("div");
    sentinel.style.position = "absolute";
    sentinel.style.top = "0";
    sentinel.style.height = "1px";
    sentinel.style.visibility = "hidden";

    const navElement = navRef.current;
    if (!navElement) return;

    navElement.parentElement?.insertBefore(sentinel, navElement);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setIsSticky(!entry.isIntersecting);
        }
      },
      { threshold: 1 },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      sentinel.remove();
    };
  }, []);

  const isCompact = variant === "compact";

  return (
    <div ref={navRef} className="sticky top-2 z-40 w-full mb-4">
      <div
        className={`flex items-center justify-between py-2 px-8 lg:px-2 transition-all duration-300 ${
          isSticky
            ? "bg-white/80 hover:bg-white/95 border border-gray-200 rounded-lg shadow-sm backdrop-blur-sm mx-8"
            : "border border-transparent"
        }`}
      >
        {/* Left controls or sidebar button */}
        {leftControls ? (
          <div className="flex items-center gap-2">{leftControls}</div>
        ) : onToggleSidebar ? (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
        ) : (
          <div className="w-6" /> // Spacer for alignment
        )}

        {/* Previous button */}
        <button
          type="button"
          onClick={onPrevious}
          disabled={!hasPrevious}
          className={`p-1 transition-colors ${
            hasPrevious
              ? "text-gray-600 hover:text-gray-900 cursor-pointer"
              : "text-gray-300 cursor-not-allowed"
          }`}
          aria-label={`Previous ${progress?.label?.toLowerCase() || "item"}`}
        >
          <ChevronLeft size={20} />
        </button>

        {/* Title and subtitle */}
        <div className="text-center flex-1 px-4 min-w-0">
          <div
            className={`text-gray-500 truncate ${isCompact ? "text-xs" : "text-xs"}`}
          >
            {title}
          </div>
          {subtitle && (
            <div className="text-[10px] text-gray-400 truncate">{subtitle}</div>
          )}
        </div>

        {/* Next button */}
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className={`p-1 transition-colors ${
            hasNext
              ? "text-gray-600 hover:text-gray-900 cursor-pointer"
              : "text-gray-300 cursor-not-allowed"
          }`}
          aria-label={`Next ${progress?.label?.toLowerCase() || "item"}`}
        >
          <ChevronRight size={20} />
        </button>

        {/* Right controls */}
        {rightControls ? (
          <div className="flex items-center gap-2">{rightControls}</div>
        ) : (
          <div className="w-6" /> // Spacer for alignment
        )}
      </div>
    </div>
  );
};
