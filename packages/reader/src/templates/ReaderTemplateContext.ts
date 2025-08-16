import type { CommandPaletteStore } from "../../command/CommandPaletteStore";
import type { ReaderStore } from "../stores/ReaderStore";
import { getSelectionContext } from "../utils/selectionUtils";

export class ReaderTemplateContext {
  constructor(
    private reader: ReaderStore,
    private palette: CommandPaletteStore, // kept for compatibility; no longer used
  ) {}

  get bookTitle(): string {
    return this.reader.metadata?.title || "Unknown Book";
  }

  get bookAuthor(): string {
    const metadata = this.reader.metadata;
    return metadata?.creator || metadata?.author || "";
  }

  get chapterTitle(): string {
    return this.reader.currentChapterTitle || "Chapter";
  }

  get selectionText(): string {
    const sel = window.getSelection();
    return sel && !sel.isCollapsed ? sel.toString().trim() : "";
  }

  get selectionContext(): string {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      const { beforeContext, selectedText, afterContext } =
        getSelectionContext(sel);
      if (!selectedText) return "";
      return `${beforeContext} ${selectedText} ${afterContext}`.trim();
    }
    return "";
  }

  // Method that returns a promise for the timestamp
  async getTimestamp(): Promise<string> {
    // Can include async operations if needed
    await new Promise((resolve) => setTimeout(resolve, 10));
    return new Date().toISOString();
  }
}
