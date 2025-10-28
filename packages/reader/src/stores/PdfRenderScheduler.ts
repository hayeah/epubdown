export class PdfRenderScheduler {
  private rendering = false;
  private pending = false;

  constructor(private readonly runOnce: () => Promise<void>) {}

  trigger() {
    this.pending = true;
    if (this.rendering) return;
    this.rendering = true;
    (async () => {
      try {
        while (this.pending) {
          this.pending = false;
          await this.runOnce();
        }
      } finally {
        this.rendering = false;
        if (this.pending) this.trigger();
      }
    })();
  }
}
