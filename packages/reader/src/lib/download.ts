export interface DownloadProgress {
  received: number;
  total?: number;
  speedBps: number;
}

export interface DownloadResult {
  blob: Blob;
  filename: string;
}

const DEFAULT_FILENAME = "download.epub";
const DEFAULT_MIME = "application/epub+zip";

export async function downloadWithProgress(
  url: string,
  onProgress: (progress: DownloadProgress) => void,
): Promise<DownloadResult> {
  const requestUrl = url.trim();

  try {
    return await fetchDownload(requestUrl, onProgress);
  } catch (error) {
    throw normalizeDownloadError(error, requestUrl);
  }
}

async function fetchDownload(
  requestUrl: string,
  onProgress: (progress: DownloadProgress) => void,
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

  const totalHeader = response.headers.get("Content-Length");
  const totalValue = totalHeader ? Number(totalHeader) : undefined;
  const total =
    totalValue !== undefined && Number.isFinite(totalValue) && totalValue > 0
      ? totalValue
      : undefined;

  const contentDisposition = response.headers.get("Content-Disposition");
  const derivedFilename =
    parseFilename(contentDisposition) ??
    deriveFilenameFromUrl(requestUrl) ??
    DEFAULT_FILENAME;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let speedEMA = 0;
  let lastSample = performance.now();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;

    chunks.push(value);
    received += value.length;

    const now = performance.now();
    const deltaMs = Math.max(1, now - lastSample);
    const instantaneous = (value.length * 1000) / deltaMs;
    speedEMA = speedEMA
      ? speedEMA * 0.85 + instantaneous * 0.15
      : instantaneous;
    lastSample = now;

    onProgress({
      received,
      total,
      speedBps: speedEMA,
    });
  }

  const contentType = sanitizeMimeType(response.headers.get("Content-Type"));
  return {
    blob: new Blob(chunks, { type: contentType }),
    filename: derivedFilename,
  };
}

function sanitizeMimeType(contentType: string | null): string {
  if (!contentType) return DEFAULT_MIME;
  const value = contentType.trim().toLowerCase();
  if (!value || value === "application/octet-stream") {
    return DEFAULT_MIME;
  }
  return contentType;
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

function normalizeDownloadError(error: unknown, originalUrl: string): Error {
  if (error instanceof TypeError) {
    const origin = safeOrigin(originalUrl);
    return new Error(
      `Download blocked by CORS for ${origin}. The server must send proper CORS headers to allow downloads.`,
    );
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error("Download failed for an unknown reason.");
}

function safeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}
