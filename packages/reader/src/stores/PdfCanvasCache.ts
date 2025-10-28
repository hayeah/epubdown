import { runInAction } from "mobx";
import type { PageRecord } from "./PdfReaderStore";

export class PdfCanvasCache {
  private bytes = 0;
  private onBytesChange: (bytes: number) => void;

  constructor(
    private readonly memoryBudgetBytes: number,
    private readonly pages: PageRecord[],
    onBytesChange: (bytes: number) => void,
  ) {
    this.onBytesChange = onBytesChange;
  }

  getBytes(): number {
    return this.bytes;
  }

  noteAttach(page: PageRecord, canvas: HTMLCanvasElement) {
    this.bytes += this.size(canvas);
    this.onBytesChange(this.bytes);
    runInAction(() => {
      page.canvas = canvas;
      page.status = "rendered";
      page.wPx = canvas.width;
      page.hPx = canvas.height;
      page.lastTouchTs = performance.now?.() ?? Date.now();
    });
  }

  noteDetach(page: PageRecord) {
    this.bytes -= this.size(page.canvas ?? null);
    if (this.bytes < 0) this.bytes = 0;
    this.onBytesChange(this.bytes);
    runInAction(() => {
      if (page.canvas) {
        page.canvas.width = 0;
        page.canvas.height = 0;
        page.canvas = null;
      }
      page.status = "detached";
    });
  }

  enforce(visible: Set<number>, pageCount: number) {
    if (this.bytes <= this.memoryBudgetBytes) return;
    // Only keep visible pages - remove all others
    const victims = this.pages
      .filter((p) => p.status === "rendered" && !visible.has(p.index0))
      .sort((a, b) => (a.lastTouchTs ?? 0) - (b.lastTouchTs ?? 0));
    for (const p of victims) {
      this.noteDetach(p);
      if (this.bytes <= this.memoryBudgetBytes) break;
    }
  }

  private size(c: HTMLCanvasElement | null | undefined) {
    return c ? (c.width | 0) * (c.height | 0) * 4 : 0;
  }
}
