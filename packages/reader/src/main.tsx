import { EPub } from "@epubdown/core";
import { observer } from "mobx-react-lite";
import { StrictMode } from "react";
import type React from "react";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BookReader } from "./ChapterRenderer";
import { RootStore, StoreProvider, useEpubStore } from "./stores/RootStore";

// Example usage component
const ExampleUsage = observer(() => {
  const epubStore = useEpubStore();
  const { epub, isLoading, currentChapterIndex } = epubStore;

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await epubStore.loadEpub(file);
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
      currentChapterIndex={currentChapterIndex}
      onChapterChange={(index) => epubStore.setCurrentChapter(index)}
    />
  );
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}
// Create root store instance
const rootStore = new RootStore();

createRoot(rootElement).render(
  <StrictMode>
    <StoreProvider value={rootStore}>
      <ExampleUsage />
    </StoreProvider>
  </StrictMode>,
);
