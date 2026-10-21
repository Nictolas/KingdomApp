/** Il nord della mappa e' una fascia di foresta, non una costa. */
export const RIGHE_FORESTA_NORD = 6;
/** Le griglie piccole di test restano prive di fascia protetta. */
export function righeForestaNord(cols: number, rows: number): number {
  return cols >= 12 && rows >= 20 ? Math.min(RIGHE_FORESTA_NORD, rows - 7) : 0;
}
export function cellaNellaForestaNord(index: number, cols: number, rows: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < cols * rows &&
    Math.floor(index / cols) < righeForestaNord(cols, rows);
}
/** Blocca anche i footprint che intersecano soltanto in parte il bosco. */
export function footprintIntersecaForestaNord(
  anchor: number, w: number, h: number, cols: number, rows: number
): boolean {
  if (anchor < 0 || w < 1 || h < 1 || cols < 1 || rows < 1) return false;
  const row = Math.floor(anchor / cols);
  return row < righeForestaNord(cols, rows) && row + h > 0;
}
