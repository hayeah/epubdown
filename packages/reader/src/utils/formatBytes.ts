const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${formatNumber(value)} ${UNITS[unitIndex]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return "0 B/s";
  }

  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatPercent(done: number, total?: number): string | null {
  if (!total || total <= 0) {
    return null;
  }
  if (!Number.isFinite(done) || done < 0) {
    return "0%";
  }

  const pct = Math.min(100, Math.max(0, Math.floor((done / total) * 100)));
  return `${pct}%`;
}

function formatNumber(value: number): string {
  if (value >= 100) {
    return value.toFixed(0);
  }
  if (value >= 10) {
    return value.toFixed(1).replace(/\.0$/, "");
  }
  return value.toFixed(1).replace(/\.0$/, "");
}
