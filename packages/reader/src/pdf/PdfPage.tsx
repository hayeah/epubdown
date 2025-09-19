import { observer } from "mobx-react-lite";
import { useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import { OpenOnDrop } from "../components/OpenOnDrop";
import { useBookLibraryStore, useEventSystem } from "../stores/RootStore";
import { PdfReaderStore } from "../stores/PdfReaderStore";
import { PdfViewer } from "./PdfViewer";

export const PdfPage = observer(() => {
  const [match, params] = useRoute("/pdf/:bookId");
  const lib = useBookLibraryStore();
  const events = useEventSystem();
  const store = useMemo(() => new PdfReaderStore(lib, events), [lib, events]);

  useEffect(() => {
    if (match && params?.bookId) {
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
      <PdfViewer store={store} />
    </OpenOnDrop>
  );
});

export default PdfPage;
