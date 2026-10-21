import { cellaNellaForestaNord } from "./mappaForestaConfine";
import {
  hasOrthogonalSandNeighbor,
  hasOrthogonalWaterNeighbor,
  isMareCell,
  type TerrenoType
} from "./riverGeneration";

/** Ogni blocco strada occupa sempre 2×2 celle. */
export const STRADA_FOOTPRINT_W = 2;
export const STRADA_FOOTPRINT_H = 2;

export type EdificioStradaMappa = {
  nome?: string;
  id?: number;
  emoji?: string;
};

export function getIndiciFootprint(anchor: number, w: number, h: number, cols: number): number[] {
  const ac = anchor % cols;
  const ar = Math.floor(anchor / cols);
  const out: number[] = [];
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      out.push((ar + dr) * cols + (ac + dc));
    }
  }
  return out;
}

/** Cella idonea al terreno strada (erba, lontana da acqua/sabbia). */
export function isCellaOkPerStrada(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): boolean {
  if (cellaNellaForestaNord(index, cols, rows) || isMareCell(index, cols, rows)) return false;
  const t = terrenoInMappa[index] ?? "erba";
  if (t !== "erba") return false;
  if (hasOrthogonalWaterNeighbor(index, terrenoInMappa, cols, rows)) return false;
  if (hasOrthogonalSandNeighbor(index, terrenoInMappa, cols, rows)) return false;
  return true;
}

/** Anchor 2×2 che contiene `cellIndex` (preferisce l’angolo più vicino al puntatore). */
export function calcolaAnchorStrada2x2(
  cellIndex: number,
  cols: number,
  rows: number
): { anchor: number | null; w: number; h: number } {
  const w = STRADA_FOOTPRINT_W;
  const h = STRADA_FOOTPRINT_H;
  const ac = cellIndex % cols;
  const ar = Math.floor(cellIndex / cols);
  const candidati: number[] = [];
  for (const dr of [0, -1] as const) {
    for (const dc of [0, -1] as const) {
      const anchor = (ar + dr) * cols + (ac + dc);
      if (anchor < 0) continue;
      const aac = anchor % cols;
      const aar = Math.floor(anchor / cols);
      if (aac + w > cols || aar + h > rows) continue;
      const celle = getIndiciFootprint(anchor, w, h, cols);
      if (celle.includes(cellIndex)) candidati.push(anchor);
    }
  }
  candidati.sort((a, b) => {
    const da = Math.abs(a - cellIndex);
    const db = Math.abs(b - cellIndex);
    if (da !== db) return da - db;
    return a - b;
  });
  return { anchor: candidati[0] ?? null, w, h };
}

export function footprintStrada2x2Valido(
  anchor: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, EdificioStradaMappa>
): boolean {
  const celle = getIndiciFootprint(anchor, STRADA_FOOTPRINT_W, STRADA_FOOTPRINT_H, cols);
  for (const i of celle) {
    if (cellaNellaForestaNord(i, cols, rows)) return false;
    const edificio = edificiInMappa[i];
    if (edificio && edificio.nome !== "Strada") return false;
    if (edificio?.nome === "Strada") continue;
    if (!isCellaOkPerStrada(i, cols, rows, terrenoInMappa)) return false;
  }
  return true;
}

export function applicaStradaFootprint2x2(
  anchor: number,
  cols: number,
  edificiInMappa: Record<number, EdificioStradaMappa>,
  stradaTemplate: EdificioStradaMappa
): void {
  for (const i of getIndiciFootprint(anchor, STRADA_FOOTPRINT_W, STRADA_FOOTPRINT_H, cols)) {
    edificiInMappa[i] = { ...stradaTemplate };
  }
}

export function puoPiazzareStrada2x2CheContiene(
  cellIndex: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, EdificioStradaMappa>
): boolean {
  const { anchor } = calcolaAnchorStrada2x2(cellIndex, cols, rows);
  if (anchor == null) return false;
  return footprintStrada2x2Valido(anchor, cols, rows, terrenoInMappa, edificiInMappa);
}

/** Piazza un blocco 2×2 che contiene `cellIndex`; false se nessun anchor valido. */
export function piazzaStrada2x2CheContiene(
  cellIndex: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, EdificioStradaMappa>,
  stradaTemplate: EdificioStradaMappa
): boolean {
  const { anchor } = calcolaAnchorStrada2x2(cellIndex, cols, rows);
  if (anchor == null) return false;
  if (!footprintStrada2x2Valido(anchor, cols, rows, terrenoInMappa, edificiInMappa)) return false;
  applicaStradaFootprint2x2(anchor, cols, edificiInMappa, stradaTemplate);
  return true;
}
