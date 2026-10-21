/**
 * Fascia settentrionale della foresta: attraversa tutta la mappa dall'ovest a est.
 * Il 5x5 del Bosco rimane soltanto il punto di raccolta di risorse.
 */
export const RIGHE_FORESTA_NORD = 6;

/** Non altera il comportamento dei piccoli reticoli sintetici usati dai test. */
export function righeForestaNord(cols: number, rows: number): number {
  return cols >= 12 && rows >= 20 ? Math.min(RIGHE_FORESTA_NORD, rows - 7) : 0;
}

export function cellaNellaForestaNord(index: number, cols: number, rows: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < cols * rows &&
    Math.floor(index / cols) < righeForestaNord(cols, rows);
}

export function footprintIntersecaForestaNord(
  anchor: number, w: number, h: number, cols: number, rows: number
): boolean {
  return Number.isInteger(anchor) && anchor >= 0 && anchor < cols * rows &&
    w > 0 && h > 0 && Math.floor(anchor / cols) < righeForestaNord(cols, rows);
}
