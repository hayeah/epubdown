export function formatRelative(time: number): string {
  const diff = Date.now() - time;
  const s = 1000;
  const m = 60 * s;
  const h = 60 * m;
  const d = 24 * h;
  if (diff < 30 * s) return "now";
  if (diff < h) return `${Math.round(diff / m)}m ago`;
  if (diff < 12 * h) return `${Math.round(diff / h)}h ago`;
  return `${Math.round(diff / d)}d ago`;
}
