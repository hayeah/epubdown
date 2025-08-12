import type { CommandPaletteStore } from "../../command/CommandPaletteStore";
import type { ReaderStore } from "../stores/ReaderStore";
import { getSelectionContext } from "../utils/selectionUtils";

export class ReaderTemplateContext {
  constructor(
    private reader: ReaderStore,
    private palette: CommandPaletteStore,
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
    // First check saved range from palette
    if (this.palette.savedRange) {
      return this.palette.savedRange.toString().trim();
    }

    // Fall back to current selection
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      return selection.toString().trim();
    }

    return "";
  }

  get selectionContext(): string {
    // First check saved range from palette
    let selection: Selection | null = null;

    if (this.palette.savedRange) {
      // Create a temporary selection from saved range
      selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(this.palette.savedRange);
      }
    } else {
      // Use current selection
      selection = window.getSelection();
    }

    if (!selection || selection.isCollapsed) {
      return "";
    }

    const context = getSelectionContext(selection);
    const { beforeContext, selectedText, afterContext } = context;

    // Format as a single string with the selection marked
    if (!selectedText) {
      return "";
    }

    return `${beforeContext} <<${selectedText}>> ${afterContext}`.trim();
  }

  // Method that returns a promise for the timestamp
  async getTimestamp(): Promise<string> {
    // Can include async operations if needed
    await new Promise((resolve) => setTimeout(resolve, 10));
    return new Date().toISOString();
  }
}
