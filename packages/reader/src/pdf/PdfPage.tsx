import { observer } from "mobx-react-lite";
import { useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import { OpenOnDrop } from "../components/OpenOnDrop";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { useBookLibraryStore, useEventSystem } from "../stores/RootStore";
import { PdfReaderStore } from "../stores/PdfReaderStore";
import { PdfViewer } from "./PdfViewer";
import { PdfSidebar } from "./PdfSidebar";
import { PdfTableOfContents } from "./PdfTableOfContents";

export const PdfPage = observer(() => {
  const [match, params] = useRoute("/pdf/:bookId");
  const lib = useBookLibraryStore();
  const events = useEventSystem();
  const store = useMemo(
    () => new PdfReaderStore(lib, events, lib.pageSizeCache),
    [lib, events],
  );

  // Build document title from PDF metadata and current TOC item
  const documentTitle = useMemo(() => {
    const parts: string[] = [];
    const tocItem = store.currentTocItem;
    if (tocItem?.title) {
      parts.push(tocItem.title);
    }
    if (store.bookTitle) {
      parts.push(store.bookTitle);
    }
    return parts.length > 0 ? parts.join(" - ") : null;
  }, [store.currentTocItem, store.bookTitle]);

  useDocumentTitle(documentTitle);

  useEffect(() => {
    if (match && params?.bookId) {
      // parseUrlParams is now called inside load() after dispose()
      void store.load(Number(params.bookId));
    }
  }, [match, params?.bookId, store]);

  useEffect(() => {
    return () => {
      store.dispose();
    };
  }, [store]);

  const handleDrop = async (files: File[]) => {
    const pdfFiles = files.filter((file) =>
      file.name.toLowerCase().endsWith(".pdf"),
    );

    if (pdfFiles.length > 0 && pdfFiles[0]) {
      try {
        const id = await lib.ensurePdf(pdfFiles[0]);
        window.open(`/pdf/${id}`, "_blank");
      } catch (error) {
        console.error("Failed to open PDF:", error);
      }
    }
  };

  if (!match) return null;

  return (
    <OpenOnDrop onDrop={handleDrop} overlayText="Drop PDF to open in new tab">
      <div className="min-h-screen bg-gray-50 relative">
        {/* Sticky anchor for sidebar positioning */}
        <div className="sticky top-0 h-0 relative z-50">
          <PdfSidebar store={store}>
            <PdfTableOfContents
              tocStore={store.tocStore}
              onPageSelect={(pageNum) => store.handleTocPageSelect(pageNum)}
              onClose={() => store.setSidebarOpen(false)}
            />
          </PdfSidebar>
        </div>

        <PdfViewer store={store} />
      </div>
    </OpenOnDrop>
  );
});

export default PdfPage;
