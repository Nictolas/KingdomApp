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
/** Due file intere di prato fra gli alberi e qualsiasi costa o fiume. */
export const RIGHE_ERBA_SOTTO_FORESTA = 2;

/** Cintura erbosa a sud della foresta, su tutta la larghezza della mappa. */
export function cellaNellaFasciaErbaSottoForesta(index: number, cols: number, rows: number): boolean {
  const righeBosco = righeForestaNord(cols, rows);
  if (!righeBosco || !Number.isInteger(index) || index < 0 || index >= cols * rows) return false;
  const riga = Math.floor(index / cols);
  return riga >= righeBosco && riga < Math.min(rows, righeBosco + RIGHE_ERBA_SOTTO_FORESTA);
}

/** Riporta a prato anche le celle modificate dalle rifiniture del terreno. Solo nuovi mondi. */
export function proteggiFasciaErbaSottoForesta(
  terreno: Record<number, "erba" | "river" | "sabbia">,
  cols: number,
  rows: number
): void {
  const righeBosco = righeForestaNord(cols, rows);
  if (!righeBosco) return;
  for (let riga = righeBosco; riga < Math.min(rows, righeBosco + RIGHE_ERBA_SOTTO_FORESTA); riga++) {
    for (let colonna = 0; colonna < cols; colonna++) {
      // L'assenza della chiave significa già «erba».
      delete terreno[riga * cols + colonna];
    }
  }
}

/** Blocca anche i footprint che intersecano soltanto in parte il bosco. */
export function footprintIntersecaForestaNord(
  anchor: number, w: number, h: number, cols: number, rows: number
): boolean {
  if (anchor < 0 || w < 1 || h < 1 || cols < 1 || rows < 1) return false;
  const row = Math.floor(anchor / cols);
  return row < righeForestaNord(cols, rows) && row + h > 0;
}
