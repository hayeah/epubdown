import { StrictMode } from "react";
import type React from "react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BookReader } from "./ChapterRenderer";
import { EPub } from "./Epub";

// Example usage component
function ExampleUsage() {
  const [epub, setEpub] = useState<EPub | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChapter, setCurrentChapter] = useState(0);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const epubInstance = await EPub.fromZip(arrayBuffer);
      setEpub(epubInstance);
    } catch (error) {
      console.error("Failed to load EPUB:", error);
      alert("Failed to load EPUB file");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        Loading EPUB...
      </div>
    );
  }

  if (!epub) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>EPUB Reader</h2>
        <p>Upload an EPUB file to start reading</p>
        <input
          type="file"
          accept=".epub"
          onChange={handleFileUpload}
          style={{
            padding: "1rem",
            border: "2px dashed #ccc",
            borderRadius: "8px",
            cursor: "pointer",
            display: "block",
            margin: "1rem auto",
          }}
        />
      </div>
    );
  }

  return (
    <BookReader
      epub={epub}
      currentChapterIndex={currentChapter}
      onChapterChange={setCurrentChapter}
    />
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}
createRoot(rootElement).render(
  <StrictMode>
    <ExampleUsage />
  </StrictMode>,
);
