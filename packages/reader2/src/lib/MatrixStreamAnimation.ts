import type { AnimHandle } from "./AgentAPI";
import { animationManager } from "./AnimationManager";

const RAND_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789§¶†‡※ΩΣΨΔΦλπξ";
const DEFAULT_FORTUNES: Fortune[] = [
  ["EPUB", "READER"],
  ["A READER", "LIVES A", "THOUSAND", "LIVES"],
  ["SO MANY", "BOOKS", "SO LITTLE", "TIME"],
  ["READ", "MORE"],
  ["TURN", "THE", "PAGE"],
  ["LOST", "IN A", "GOOD", "BOOK"],
  ["ONCE", "UPON", "A TIME"],
  ["NOT ALL", "WHO", "WANDER", "ARE LOST"],
  ["THE END", "IS JUST", "THE", "BEGINNING"],
];

const FONT_SIZE = 11;
const CELL_W = 8;
const CELL_H = 13;
const FONT = `${FONT_SIZE}px "SF Mono", "Fira Code", "Consolas", monospace`;
const SHIFT_INTERVAL = 120;

const CATCH_START = 3000;
const CATCH_DUR = 2000;
const HOLD_DUR = 6000;
const RELEASE_DUR = 1500;
const STREAM_OUT = 4000;
const CYCLE_TOTAL = CATCH_START + CATCH_DUR + HOLD_DUR + RELEASE_DUR + STREAM_OUT;

const SEED = 42;
const MAX_COLS = 256;

const ORANGE_STYLE = "rgba(234,88,12,0.9)";

// Pre-computed background fill styles at quantized opacity levels
const BG_STYLE_COUNT = 32;
const BG_STYLES: string[] = [];
for (let i = 0; i < BG_STYLE_COUNT; i++) {
  const opacity = 0.04 + (i / (BG_STYLE_COUNT - 1)) * 0.08;
  BG_STYLES.push(`rgba(160,130,90,${opacity.toFixed(4)})`);
}

export type FortuneLine = string | { text: string; color: string };
export type Fortune = FortuneLine[];

function normalizeLines(fortune: Fortune): { text: string; color: string }[] {
  return fortune.map((line) =>
    typeof line === "string" ? { text: line, color: ORANGE_STYLE } : line,
  );
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type NoiseMode = "sine" | "perlin";

// --- 2D simplex-style noise (gradient noise with permutation table) ---

const PERM = new Uint8Array(512);
const GRAD = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// Initialize permutation table from seed
{
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher-Yates with deterministic seed
  const rng = mulberry32(SEED);
  for (let i = 255; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function lerp(a: number, b: number, t: number) {
  return a + t * (b - a);
}

function perlin2d(x: number, y: number): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);

  const aa = PERM[PERM[xi] + yi];
  const ab = PERM[PERM[xi] + yi + 1];
  const ba = PERM[PERM[xi + 1] + yi];
  const bb = PERM[PERM[xi + 1] + yi + 1];

  const g = (hash: number, dx: number, dy: number) => {
    const gr = GRAD[hash & 7];
    return gr[0] * dx + gr[1] * dy;
  };

  return lerp(
    lerp(g(aa, xf, yf), g(ba, xf - 1, yf), u),
    lerp(g(ab, xf, yf - 1), g(bb, xf - 1, yf - 1), u),
    v,
  );
}

export interface NoiseParams {
  mode: NoiseMode;
  /** Base opacity (center of range) */
  base: number;
  /** Amplitude of noise oscillation */
  amplitude: number;
  /** How fast the noise pattern drifts over time */
  speed: number;
  /** Spatial scale — higher = larger blobs/waves */
  scale: number;
  /** Perlin: weight of second octave (0–1) */
  octave2: number;
}

export const DEFAULT_NOISE_PARAMS: NoiseParams = {
  mode: "perlin",
  base: 0.08,
  amplitude: 0.04,
  speed: 1.0,
  scale: 1.0,
  octave2: 0.5,
};

export { DEFAULT_FORTUNES, CYCLE_TOTAL };

export class MatrixStreamAnimation implements AnimHandle {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private parent: HTMLElement;
  private dpr: number;
  private fortunes: Fortune[];

  private cols = 0;
  private rows = 0;
  private buf: string[] = [];
  private swapBuf: string[] = [];
  private pinAt = new Float64Array(0);
  private unpinAt = new Float64Array(0);
  private targetChar: string[] = [];
  private targetColor: string[] = [];
  private hasTarget = new Uint8Array(0);
  private lastShift = 0;
  private cycleStart = 0;
  private currentElapsed = 0;
  private fortuneIdx = 0;
  private releasedSet = new Set<number>();
  private rng: () => number;
  private isPaused = true;

  /** Noise parameters — mutate freely, changes take effect next frame. */
  noise: NoiseParams;

  constructor(canvas: HTMLCanvasElement, opts?: { fortunes?: Fortune[]; noiseMode?: NoiseMode }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.parent = canvas.parentElement!;
    this.dpr = window.devicePixelRatio || 1;
    this.fortunes = opts?.fortunes ?? DEFAULT_FORTUNES;
    this.noise = { ...DEFAULT_NOISE_PARAMS, mode: opts?.noiseMode ?? "perlin" };
    this.rng = mulberry32(SEED);
    this.buildBuffers();
  }

  // --- AnimHandle interface ---

  start() {
    if (!this.isPaused) return;
    this.isPaused = false;
    // Reset cycleStart so tick re-anchors from currentElapsed
    this.cycleStart = 0;
    animationManager.register(this.tick, SHIFT_INTERVAL);
  }

  pause() {
    this.isPaused = true;
    animationManager.unregister(this.tick);
  }

  reset() {
    this.pause();
    this.cycleStart = 0;
    this.lastShift = 0;
    this.currentElapsed = 0;
    this.replayToTime(0);
    this.renderFrame(0, 0);
  }

  paused() {
    return this.isPaused;
  }

  scrub(elapsed: number) {
    this.pause();
    this.replayToTime(elapsed);
    this.currentElapsed = elapsed;
    this.renderFrame(elapsed, elapsed);
  }

  renderOnce(elapsed?: number): number {
    const t = elapsed ?? this.currentElapsed;
    if (elapsed !== undefined) {
      this.replayToTime(t);
    }
    const start = performance.now();
    this.renderFrame(t, t);
    return performance.now() - start;
  }

  state() {
    return {
      elapsed: this.currentElapsed,
      fortuneIdx: this.fortuneIdx,
      cols: this.cols,
      rows: this.rows,
      cycleTotal: CYCLE_TOTAL,
    };
  }

  // --- Lifecycle ---

  /** Render initial frame (call after construction). */
  renderInitial(opts?: { staticTime?: number; autoPlay?: boolean }) {
    if (opts?.staticTime !== undefined) {
      this.replayToTime(opts.staticTime);
      this.renderFrame(opts.staticTime, opts.staticTime);
    } else {
      this.renderFrame(0, 0);
      if (opts?.autoPlay) {
        this.start();
      }
    }
  }

  /** Call on window resize. */
  handleResize = () => {
    const w = this.parent.offsetWidth;
    const h = this.parent.offsetHeight;
    // Skip rebuild if size unchanged — iOS Safari fires resize during
    // overscroll bounce, which would nuke the buffer and cause flicker.
    if (w === this.lastW && h === this.lastH) return;
    this.buildBuffers();
  };

  /** Unregister from the shared animation loop. */
  dispose() {
    animationManager.unregister(this.tick);
  }

  // --- Internal ---

  private randChar() {
    return RAND_CHARS[Math.floor(this.rng() * RAND_CHARS.length)];
  }

  private cellKey(r: number, c: number) {
    return r * MAX_COLS + c;
  }

  private tick = (t: number) => {
    if (this.isPaused) return;

    // Re-anchor so we resume from currentElapsed
    if (this.cycleStart === 0) this.cycleStart = t - this.currentElapsed;
    let elapsed = t - this.cycleStart;

    if (elapsed > CYCLE_TOTAL) {
      this.cycleStart = t;
      elapsed = 0;
      this.fortuneIdx = (this.fortuneIdx + 1) % this.fortunes.length;
      this.setTargets(this.fortunes[this.fortuneIdx]);
    }

    this.shiftBuffers(elapsed);
    this.currentElapsed = elapsed;
    this.renderFrame(elapsed, t);
  };

  private lastW = 0;
  private lastH = 0;

  private buildBuffers() {
    const w = this.parent.offsetWidth;
    const h = this.parent.offsetHeight;
    this.lastW = w;
    this.lastH = h;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.cols = Math.floor(w / CELL_W);
    this.rows = Math.floor(h / CELL_H);

    this.rng = mulberry32(SEED);
    this.fortuneIdx = Math.floor(this.rng() * this.fortunes.length);

    const total = this.rows * this.cols;
    this.buf = new Array(total);
    this.swapBuf = new Array(total);
    for (let i = 0; i < total; i++) {
      this.buf[i] = this.randChar();
    }

    this.setTargets(this.fortunes[this.fortuneIdx]);
  }

  private setTargets(fortune: Fortune) {
    const lines = normalizeLines(fortune);
    const total = this.rows * MAX_COLS;
    if (this.pinAt.length < total) {
      this.pinAt = new Float64Array(total);
      this.unpinAt = new Float64Array(total);
      this.targetChar = new Array(total);
      this.targetColor = new Array(total);
      this.hasTarget = new Uint8Array(total);
    } else {
      this.pinAt.fill(0);
      this.unpinAt.fill(0);
      this.hasTarget.fill(0);
    }

    const startRow = Math.floor((this.rows - lines.length) / 2);
    const targets: { key: number; ch: string; col: number }[] = [];

    for (let li = 0; li < lines.length; li++) {
      const { text, color } = lines[li];
      const startCol = Math.floor((this.cols - text.length) / 2);
      for (let ci = 0; ci < text.length; ci++) {
        const key = this.cellKey(startRow + li, startCol + ci);
        this.hasTarget[key] = 1;
        this.targetChar[key] = text[ci];
        this.targetColor[key] = color;
        targets.push({ key, ch: text[ci], col: startCol + ci });
      }
    }

    let minCol = Infinity,
      maxCol = -Infinity;
    for (const t of targets) {
      if (t.col < minCol) minCol = t.col;
      if (t.col > maxCol) maxCol = t.col;
    }
    const colSpan = maxCol - minCol || 1;

    for (const t of targets) {
      const frac = (t.col - minCol) / colSpan;
      this.pinAt[t.key] = CATCH_START + (1 - frac) * CATCH_DUR + this.rng() * 200;
      this.unpinAt[t.key] =
        CATCH_START + CATCH_DUR + HOLD_DUR + frac * RELEASE_DUR + this.rng() * 200;
    }
  }

  private isCellPinned(key: number, elapsed: number): boolean {
    if (!this.hasTarget[key]) return false;
    return elapsed >= this.pinAt[key] && elapsed < this.unpinAt[key];
  }

  private shiftBuffers(elapsed: number) {
    for (let r = 0; r < this.rows; r++) {
      const rowOff = r * this.cols;
      const rowKeyOff = r * MAX_COLS;
      for (let c = 0; c < this.cols; c++) {
        const key = rowKeyOff + c;
        if (this.isCellPinned(key, elapsed)) {
          this.swapBuf[rowOff + c] = this.targetChar[key];
        } else {
          let src = c + 1;
          while (src < this.cols && this.isCellPinned(rowKeyOff + src, elapsed)) {
            src++;
          }
          if (src < this.cols) {
            this.swapBuf[rowOff + c] = this.buf[rowOff + src];
          } else {
            this.swapBuf[rowOff + c] = this.randChar();
          }
        }
      }
    }
    const tmp = this.buf;
    this.buf = this.swapBuf;
    this.swapBuf = tmp;
  }

  private replayToTime(targetTime: number) {
    this.rng = mulberry32(SEED);
    this.fortuneIdx = Math.floor(this.rng() * this.fortunes.length);

    const total = this.rows * this.cols;
    this.buf = new Array(total);
    this.swapBuf = new Array(total);
    for (let i = 0; i < total; i++) {
      this.buf[i] = this.randChar();
    }

    const cycleIdx = Math.floor(targetTime / CYCLE_TOTAL);
    const elapsed = targetTime % CYCLE_TOTAL;
    this.fortuneIdx = cycleIdx % this.fortunes.length;
    this.setTargets(this.fortunes[this.fortuneIdx]);

    const shiftCount = Math.floor(elapsed / SHIFT_INTERVAL);
    for (let i = 0; i < shiftCount; i++) {
      this.shiftBuffers((i + 1) * SHIFT_INTERVAL);
    }
  }

  private renderFrame(elapsed: number, t: number) {
    const w = this.parent.offsetWidth;
    const h = this.parent.offsetHeight;

    // Build released cells set
    this.releasedSet.clear();
    const total = this.rows * MAX_COLS;
    for (let k = 0; k < total; k++) {
      if (!this.hasTarget[k]) continue;
      const ut = this.unpinAt[k];
      if (elapsed >= ut) {
        const r = (k / MAX_COLS) | 0;
        const c = k - r * MAX_COLS;
        const shiftsSinceRelease = ((elapsed - ut) / SHIFT_INTERVAL) | 0;
        const currentCol = c - shiftsSinceRelease;
        if (currentCol >= 0) {
          this.releasedSet.add(r * MAX_COLS + currentCol);
        }
      }
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    ctx.font = FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // First pass: pinned + released cells
    let lastColor = "";
    for (let r = 0; r < this.rows; r++) {
      const rowOff = r * this.cols;
      const rowKeyOff = r * MAX_COLS;
      for (let c = 0; c < this.cols; c++) {
        const key = rowKeyOff + c;
        if (this.isCellPinned(key, elapsed) || this.releasedSet.has(key)) {
          const color = this.targetColor[key] || ORANGE_STYLE;
          if (color !== lastColor) {
            ctx.fillStyle = color;
            lastColor = color;
          }
          ctx.fillText(this.buf[rowOff + c], c * CELL_W + CELL_W / 2, r * CELL_H + CELL_H / 2);
        }
      }
    }

    // Second pass: background cells
    const { mode, base, amplitude, speed, scale, octave2 } = this.noise;
    const tSec = t * 0.001 * speed;
    const usePerlin = mode === "perlin";
    const invScale = 1 / scale;
    // Perlin: slow drift offset
    const px = tSec * 0.15;
    const py = tSec * 0.1;
    for (let r = 0; r < this.rows; r++) {
      const rowOff = r * this.cols;
      const rowKeyOff = r * MAX_COLS;
      for (let c = 0; c < this.cols; c++) {
        const key = rowKeyOff + c;
        if (this.isCellPinned(key, elapsed) || this.releasedSet.has(key)) continue;
        let n: number;
        if (usePerlin) {
          const cx = c * 0.15 * invScale;
          const cy = r * 0.2 * invScale;
          const n1 = perlin2d(cx + px, cy + py);
          const n2 = perlin2d(cx * 2 + px * 1.7, cy * 2 + py * 1.3) * octave2;
          n = base + amplitude * (n1 + n2);
        } else {
          const phase1 = tSec * 0.3;
          const phase2 = tSec * 0.17;
          const s1 = Math.sin(phase1 + r * 0.4 * invScale + c * 0.25 * invScale);
          const s2 = Math.sin(phase2 + r * 0.15 * invScale - c * 0.35 * invScale + 2.0);
          n = base + amplitude * (s1 * 0.6 + s2 * 0.4);
        }
        const idx = Math.max(
          0,
          Math.min(BG_STYLE_COUNT - 1, (((n - 0.04) * (BG_STYLE_COUNT - 1)) / 0.08) | 0),
        );
        ctx.fillStyle = BG_STYLES[idx];
        ctx.fillText(this.buf[rowOff + c], c * CELL_W + CELL_W / 2, r * CELL_H + CELL_H / 2);
      }
    }
  }
}
