import { makeAutoObservable } from "mobx";

export type PageStatus =
  | "idle"
  | "sizing"
  | "ready"
  | "rendering"
  | "rendered"
  | "detached"
  | "error";

export class PageRecord {
  index0: number;
  status: PageStatus = "idle";
  wPt?: number;
  hPt?: number;
  wPx?: number;
  hPx?: number;
  canvas?: HTMLCanvasElement | null;
  lastTouchTs?: number;
  error?: string;

  constructor(index0: number) {
    this.index0 = index0;
    makeAutoObservable(this, {}, { autoBind: true });
  }

  touch() {
    this.lastTouchTs =
      typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  setSizeFromPt(ppi: number) {
    if (this.wPt && this.hPt) {
      this.wPx = Math.max(1, Math.floor((this.wPt * ppi) / 72));
      this.hPx = Math.max(1, Math.floor((this.hPt * ppi) / 72));
    }
  }

  ensureCanvas(): HTMLCanvasElement {
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
    }
    return this.canvas;
  }
}
