import { observer } from "mobx-react-lite";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { useReaderStore } from "../stores/RootStore";

// Footnote component that uses ReaderStore directly
export interface FootnoteProps {
  href: string;
  id?: string;
  children: React.ReactNode;
  className?: string;
}

export const Footnote: React.FC<FootnoteProps> = observer(
  ({ href, id, children, className }) => {
    const readerStore = useReaderStore();
    const [isPopoverVisible, setIsPopoverVisible] = useState(false);
    const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
    const [footnoteContent, setFootnoteContent] = useState<string | null>(null);
    const footnoteRef = useRef<HTMLSpanElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    // Load footnote content
    const loadFootnoteContent = useCallback(async () => {
      if (footnoteContent) return;

      const currentChapter = readerStore.currentChapter;
      if (!currentChapter) return;

      try {
        const content = await readerStore.getFootnote(currentChapter, href);
        setFootnoteContent(content);
      } catch (err) {
        console.error("Failed to load footnote:", err);
        setFootnoteContent("Failed to load footnote");
      }
    }, [footnoteContent, href, readerStore]);

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
        updatePopoverPosition(event);
        setIsPopoverVisible(true);
        loadFootnoteContent();
      },
      [updatePopoverPosition, loadFootnoteContent],
    );

    const handleMouseLeave = useCallback(() => {
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

    const popoverStyle: React.CSSProperties = {
      position: "absolute",
      left: `${popoverPosition.x}px`,
      top: `${popoverPosition.y}px`,
      transform: "translateX(-50%) translateY(-100%)",
      display: isPopoverVisible ? "block" : "none",
    };

    return (
      <>
        <button
          ref={footnoteRef as any}
          type="button"
          className={`text-blue-600 cursor-pointer underline text-sm font-bold rounded-sm px-0.5 py-0.5 bg-blue-600/10 border-none hover:bg-blue-600/20 transition-colors ${className || ""}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick(e as any);
            }
          }}
          aria-describedby={id ? `footnote-${id}` : undefined}
        >
          {children}
        </button>

        {isPopoverVisible && (
          <div
            ref={popoverRef}
            style={popoverStyle}
            className="bg-white border border-gray-300 rounded-md p-3 max-w-xs shadow-lg z-[1000] text-sm leading-relaxed text-gray-700"
            id={id ? `footnote-${id}` : undefined}
            role="tooltip"
            aria-live="polite"
          >
            {!footnoteContent ? (
              <div className="text-gray-500 italic">Loading...</div>
            ) : (
              <div>{footnoteContent}</div>
            )}
            {/* Arrow pointing down */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white" />
          </div>
        )}
      </>
    );
  },
);
