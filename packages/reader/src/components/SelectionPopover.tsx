import { Copy } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface SelectionPopoverProps {
  onCopyWithContext: () => void;
}

export const SelectionPopover: React.FC<SelectionPopoverProps> = ({
  onCopyWithContext,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Selection | null>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setIsVisible(false);
        selectionRef.current = null;
        return;
      }

      // Check if selection is within chapter content
      const range = selection.getRangeAt(0);
      const commonAncestor = range.commonAncestorContainer;
      const element =
        commonAncestor.nodeType === Node.TEXT_NODE
          ? commonAncestor.parentElement
          : (commonAncestor as Element);

      // Check if the selection is within a chapter content area
      const isInChapterContent = element?.closest(
        ".chapter-content, .epub-chapter",
      );
      if (!isInChapterContent) {
        setIsVisible(false);
        selectionRef.current = null;
        return;
      }

      selectionRef.current = selection;
      const rect = range.getBoundingClientRect();

      // Position the popover above the selection
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + window.scrollY - 8, // 8px above the selection
      });
      setIsVisible(true);
    };

    // Only show popover on mouseup/touchend
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchend", handleMouseUp);

    // Hide popover when selection is cleared
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setIsVisible(false);
        selectionRef.current = null;
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);

    // Hide popover on scroll
    const handleScroll = () => {
      if (isVisible) {
        setIsVisible(false);
      }
    };
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleMouseUp);
      document.removeEventListener("selectionchange", handleSelectionChange);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isVisible]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onCopyWithContext();
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: "absolute",
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translate(-50%, -100%)",
        zIndex: 10000,
      }}
      className="bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm"
    >
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-2 hover:bg-gray-700 rounded px-2 py-1 transition-colors"
        aria-label="Copy with context"
      >
        <Copy className="w-4 h-4" />
        <span>Copy with context</span>
      </button>
      {/* Arrow pointing down */}
      <div
        className="absolute -bottom-1 left-1/2 -translate-x-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: "6px solid rgb(31 41 55)", // bg-gray-800
        }}
      />
    </div>,
    document.body,
  );
};
