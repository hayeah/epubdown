import { observer } from "mobx-react-lite";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { useReaderStore } from "../stores/RootStore";

export interface FootnoteProps {
  href: string;
  id?: string;
  children: React.ReactNode;
  className?: string;
}

export const Footnote: React.FC<FootnoteProps> = observer(({ href, id, children, className }) => {
  const readerStore = useReaderStore();
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [content, setContent] = useState<string | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  const loadContent = useCallback(async () => {
    if (content) return;
    const chapter = readerStore.currentChapter;
    if (!chapter) return;
    try {
      const text = await readerStore.getFootnote(chapter, href);
      setContent(text);
    } catch {
      setContent("Failed to load footnote");
    }
  }, [content, href, readerStore]);

  const updatePosition = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    setPosition({ x: rect.left + rect.width / 2, y: rect.top + scrollTop - 10 });
  }, []);

  const handleMouseEnter = useCallback(() => {
    updatePosition();
    setIsVisible(true);
    loadContent();
  }, [updatePosition, loadContent]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!isVisible) {
        updatePosition();
        setIsVisible(true);
        loadContent();
      } else {
        setIsVisible(false);
      }
    },
    [isVisible, updatePosition, loadContent],
  );

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`text-blue-600 cursor-pointer underline text-sm font-bold rounded-sm px-0.5 py-0.5 bg-blue-600/10 border-none hover:bg-blue-600/20 transition-colors ${className || ""}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsVisible(false)}
        onClick={handleClick}
      >
        {children}
      </button>
      {isVisible && (
        <div
          style={{
            position: "absolute",
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: "translateX(-50%) translateY(-100%)",
          }}
          className="bg-white border border-gray-300 rounded-md p-3 max-w-xs shadow-lg z-[1000] text-sm leading-relaxed text-gray-700"
          id={id ? `footnote-${id}` : undefined}
          role="tooltip"
        >
          {!content ? <div className="text-gray-500 italic">Loading...</div> : <div>{content}</div>}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white" />
        </div>
      )}
    </>
  );
});
