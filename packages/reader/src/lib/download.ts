export interface DownloadProgress {
  received: number;
  total?: number;
  speedBps: number;
}

export interface DownloadResult {
  blob: Blob;
  filename?: string;
}

const CORS_PROXY = "https://api.allorigins.win/raw";

class ProgressTracker {
  private received = 0;
  private speedEMA = 0;
  private lastSample = performance.now();

  constructor(
    private total: number | undefined,
    private onProgress: (progress: DownloadProgress) => void,
  ) {}

  update(chunkSize: number) {
    this.received += chunkSize;

    const now = performance.now();
    const deltaMs = Math.max(1, now - this.lastSample);
    const instantaneous = (chunkSize * 1000) / deltaMs;
    this.speedEMA = this.speedEMA
      ? this.speedEMA * 0.85 + instantaneous * 0.15
      : instantaneous;
    this.lastSample = now;

    this.onProgress({
      received: this.received,
      total: this.total,
      speedBps: this.speedEMA,
    });
  }
}

export class Downloader {
  constructor(private useCorsProxy = true) {}

  async downloadWithProgress(
    url: string,
    onProgress: (progress: DownloadProgress) => void,
  ): Promise<DownloadResult> {
    const requestUrl = url.trim();
    const fetchUrl = this.useCorsProxy
      ? this.buildProxyUrl(requestUrl)
      : requestUrl;
    const originalUrl = this.useCorsProxy ? requestUrl : undefined;

    return this.fetchDownload(fetchUrl, onProgress, originalUrl);
  }

  private buildProxyUrl(url: string): string {
    return `${CORS_PROXY}?url=${encodeURIComponent(url)}`;
  }

  private async fetchDownload(
    requestUrl: string,
    onProgress: (progress: DownloadProgress) => void,
    originalUrl?: string,
  ): Promise<DownloadResult> {
    const response = await fetch(requestUrl, { mode: "cors" });
    if (!response.ok) {
      throw new Error(
        `Download failed: HTTP ${response.status} ${response.statusText}`,
      );
    }
    if (!response.body) {
      throw new Error(
        "Download failed: response does not contain a readable body",
      );
    }

    const total = this.parseContentLength(
      response.headers.get("Content-Length"),
    );
    const filename = this.deriveFilename(
      response.headers.get("Content-Disposition"),
      originalUrl ?? requestUrl,
    );

    const chunks = await this.readStream(response.body, total, onProgress);
    const contentType = response.headers.get("Content-Type");

    return {
      blob: new Blob(chunks, { type: contentType ?? undefined }),
      filename,
    };
  }

  private parseContentLength(header: string | null): number | undefined {
    if (!header) return undefined;
    const value = Number(header);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  private async readStream(
    body: ReadableStream<Uint8Array>,
    total: number | undefined,
    onProgress: (progress: DownloadProgress) => void,
  ): Promise<Uint8Array[]> {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    const tracker = new ProgressTracker(total, onProgress);

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      chunks.push(value);
      tracker.update(value.length);
    }

    return chunks;
  }

  private deriveFilename(
    contentDisposition: string | null,
    url: string,
  ): string | undefined {
    const filename =
      parseFilename(contentDisposition) ?? deriveFilenameFromUrl(url);
    return filename ?? undefined;
  }
}

// Convenience function using default downloader
export async function downloadWithProgress(
  url: string,
  onProgress: (progress: DownloadProgress) => void,
): Promise<DownloadResult> {
  const downloader = new Downloader(true);
  return downloader.downloadWithProgress(url, onProgress);
}

function parseFilename(header: string | null): string | null {
  if (!header) return null;

  // RFC 5987 format: filename*=UTF-8''encoded-name
  const starMatch = header.match(/filename\*\s*=\s*([^;]+)/i);
  if (starMatch) {
    const rawValue = starMatch[1];
    if (!rawValue) return null;

    const value = rawValue.trim();
    const parts = value.split("''", 2);
    const encoded = parts.length === 2 ? parts[1] : parts[0];
    const stripped = stripQuotes(encoded);
    if (!stripped) return null;

    try {
      return decodeURIComponent(stripped);
    } catch {
      return stripped;
    }
  }

  const regularMatch = header.match(/filename\s*=\s*([^;]+)/i);
  if (regularMatch) {
    const stripped = stripQuotes(regularMatch[1]?.trim());
    return stripped;
  }

  return null;
}

function deriveFilenameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    const lastSegment = segments[segments.length - 1];
    if (!lastSegment) return null;
    const decoded = decodeURIComponent(lastSegment);
    return decoded || null;
  } catch {
    return null;
  }
}

function stripQuotes(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
