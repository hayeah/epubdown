import type { CommandPaletteStore } from "../../command/CommandPaletteStore";
import type { CollectionReaderStore } from "../stores/CollectionReaderStore";
import { getSelectionContext } from "../utils/selectionUtils";

export class CollectionTemplateContext {
  constructor(
    private reader: CollectionReaderStore,
    private palette: CommandPaletteStore, // kept for compatibility
  ) {}

  // Collection/book level info
  get collectionName(): string {
    return this.reader.collection?.name || "Unknown Collection";
  }

  // Alias for consistency with EPUB reader (uses bookTitle)
  get bookTitle(): string {
    return this.collectionName;
  }

  // File/chapter level info
  get fileName(): string {
    return (
      this.reader.currentFile?.title || this.reader.currentFilePath || "File"
    );
  }

  // Alias for consistency with EPUB reader (uses chapterTitle)
  get chapterTitle(): string {
    return this.fileName;
  }

  get fileContent(): string {
    return this.reader.currentFile?.content || "";
  }

  get selectionText(): string {
    const sel = window.getSelection();
    return sel && !sel.isCollapsed ? sel.toString().trim() : "";
  }

  get selectionContext(): string {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      // Use collection-reader as the container scope
      const container = document.querySelector(".collection-reader");
      const { beforeContext, selectedText, afterContext } = getSelectionContext(
        sel,
        container ?? undefined,
      );
      if (!selectedText) return "";
      return `${beforeContext} <<${selectedText}>> ${afterContext}`.trim();
    }
    return "";
  }

  // For consistency with EPUB reader, provide chapterContent alias
  async chapterContent(): Promise<string> {
    return this.fileContent;
  }

  // Method that returns a promise for the timestamp
  async getTimestamp(): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return new Date().toISOString();
  }
}
