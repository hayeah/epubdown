export const ZOOM_PPI_LEVELS = [72, 96, 120, 144, 168, 192];

export const DEFAULT_PAGE_PT = {
  w: 612, // US Letter width in points
  h: 792, // US Letter height in points
};

export const PPI_TO_DPI = 72; // Points per inch

export function ppiForFitWidth(
  cssWidthPx: number,
  dpr: number,
  page: { wPt?: number; wPx?: number },
  currentPpi: number,
  min = 48,
  max = 384,
): number | null {
  let ppi = null as number | null;
  if (page.wPt && page.wPt > 0) {
    ppi = Math.round((72 * cssWidthPx * dpr) / page.wPt);
  } else if (page.wPx && page.wPx > 0) {
    ppi = Math.round((cssWidthPx * dpr * currentPpi) / page.wPx);
  }
  return ppi ? Math.max(min, Math.min(max, ppi)) : null;
}
