import { observer } from "mobx-react-lite";
import type React from "react";
import { ReaderHeader } from "../components/ReaderHeader";
import { useReaderStore } from "../stores/RootStore";

export const ChapterNavigation: React.FC = observer(() => {
  const readerStore = useReaderStore();

  const { currentChapterIndex, chapters, metadata } = readerStore;
  const currentChapterTitle = readerStore.currentChapterTitle;
  const bookTitle = metadata.title;
  const totalChapters = chapters.length;

  const hasPrevious = currentChapterIndex > 0;
  const hasNext = currentChapterIndex < totalChapters - 1;

  const handlePrevious = () => {
    if (hasPrevious) {
      readerStore.handleChapterChange(currentChapterIndex - 1);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      readerStore.handleChapterChange(currentChapterIndex + 1);
    }
  };

  return (
    <ReaderHeader
      title={currentChapterTitle ?? bookTitle}
      subtitle={bookTitle || "Unknown Book"}
      hasPrevious={hasPrevious}
      hasNext={hasNext}
      onPrevious={handlePrevious}
      onNext={handleNext}
      progress={{
        current: currentChapterIndex + 1,
        total: totalChapters,
        label: "Chapter",
      }}
      onToggleSidebar={() => readerStore.setSidebarOpen(true)}
    />
  );
});
