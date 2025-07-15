import { useLocation } from "wouter";
import { BookLibrary } from "./components/BookLibrary";

export function BookLibraryPage() {
  const [, navigate] = useLocation();

  const handleOpenBook = (bookId: string, chapterIndex = 0) => {
    navigate(`/book/${bookId}/${chapterIndex}`);
  };

  return <BookLibrary onOpenBook={handleOpenBook} />;
}
