import type { TerrenoType } from "./riverGeneration";

function isAcquaCell(index: number, cols: number, rows: number): boolean {
  const row = Math.floor(index / cols);
  const col = index % cols;
  return row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
}

function isWaterAt(
  row: number,
  col: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): boolean {
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
  const index = row * cols + col;
  if (isAcquaCell(index, cols, rows)) return true;
  return (terrenoInMappa[index] ?? "erba") === "river";
}

function isSandAt(
  row: number,
  col: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): boolean {
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
  return (terrenoInMappa[row * cols + col] ?? "erba") === "sabbia";
}

/** Indice 0…8 nel blocco 3×3 (TL,T,TR / L,C,R / BL,B,BR). */
export type Tile3x3Index = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Indice 0…3 nel blocco 2×2 (TL,TR,BL,BR). */
export type Tile2x2Index = 0 | 1 | 2 | 3;

function subtile9FromMask(mask: number): Tile3x3Index {
  switch (mask) {
    case 0:
      return 4;
    case 1:
      return 1;
    case 2:
      return 5;
    case 3:
      return 2;
    case 4:
      return 7;
    case 5:
      return 1;
    case 6:
      return 8;
    case 7:
      return 2;
    case 8:
      return 3;
    case 9:
      return 0;
    case 10:
      return 3;
    case 11:
      return 1;
    case 12:
      return 6;
    case 13:
      return 3;
    case 14:
      return 7;
    case 15:
    default:
      return 4;
  }
}

/**
 * Autotile spiaggia: vicini cardinali con acqua (fiume o mare).
 */
export function getSandBeachSubtile(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): Tile3x3Index {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const n = isWaterAt(row - 1, col, cols, rows, terrenoInMappa);
  const e = isWaterAt(row, col + 1, cols, rows, terrenoInMappa);
  const s = isWaterAt(row + 1, col, cols, rows, terrenoInMappa);
  const w = isWaterAt(row, col - 1, cols, rows, terrenoInMappa);
  const mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
  return subtile9FromMask(mask);
}

export function isStradaCell(
  row: number,
  col: number,
  cols: number,
  rows: number,
  edificiInMappa: Record<number, { nome?: string }>
): boolean {
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
  return edificiInMappa[row * cols + col]?.nome === "Strada";
}

/**
 * Autotile strada terra (blocco 3×3): dove il vicino NON è strada serve il bordo verso erba/altro.
 */
export function getRoadDirtSubtile(
  index: number,
  cols: number,
  rows: number,
  edificiInMappa: Record<number, { nome?: string }>
): Tile3x3Index {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const n = !isStradaCell(row - 1, col, cols, rows, edificiInMappa);
  const e = !isStradaCell(row, col + 1, cols, rows, edificiInMappa);
  const s = !isStradaCell(row + 1, col, cols, rows, edificiInMappa);
  const w = !isStradaCell(row, col - 1, cols, rows, edificiInMappa);
  const mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
  return subtile9FromMask(mask);
}

/**
 * Quale quarto del motivo erba 2×2 usare (ripetizione a scacchiera sulla mappa).
 */
export function getGrass2x2Index(index: number, cols: number): Tile2x2Index {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return ((((row & 1) << 1) | (col & 1)) as Tile2x2Index);
}

/**
 * Celle erba confinanti con strada: maschera come spiaggia/sabbia (strada = “feature” nel bitmask).
 * Ha priorità sulla fascia erba–sabbia se un vicino è strada.
 */
export function getGrassRoadBorderSubtileIfAny(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, { nome?: string }>
): Tile3x3Index | undefined {
  if ((terrenoInMappa[index] ?? "erba") !== "erba") return undefined;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const n = isStradaCell(row - 1, col, cols, rows, edificiInMappa);
  const e = isStradaCell(row, col + 1, cols, rows, edificiInMappa);
  const s = isStradaCell(row + 1, col, cols, rows, edificiInMappa);
  const w = isStradaCell(row, col - 1, cols, rows, edificiInMappa);
  if (!n && !e && !s && !w) return undefined;
  const mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
  return subtile9FromMask(mask);
}

/**
 * Celle erba confinanti con sabbia: stesso schema maschera della spiaggia (sabbia = “acqua” nel bitmask).
 * Se nessun vicino è sabbia, l’erba usa solo il motivo 2×2.
 */
export function getGrassSandBorderSubtileIfAny(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, { nome?: string }>
): Tile3x3Index | undefined {
  if ((terrenoInMappa[index] ?? "erba") !== "erba") return undefined;
  const col = index % cols;
  const row = Math.floor(index / cols);
  if (
    isStradaCell(row - 1, col, cols, rows, edificiInMappa) ||
    isStradaCell(row, col + 1, cols, rows, edificiInMappa) ||
    isStradaCell(row + 1, col, cols, rows, edificiInMappa) ||
    isStradaCell(row, col - 1, cols, rows, edificiInMappa)
  ) {
    return undefined;
  }
  /**
   * Sopra la fascia “erba buffer → strada”: il vicino sotto è ancora erba, non Strada, quindi
   * non si applica il bordo erba–strada; senza questa regola la sabbia in diagonale attiva
   * l’angolo erba–sabbia al posto dell’erba centrale 2×2.
   * Se a nord c’è già sabbia (costa), il bordo sabbia resta consentito.
   */
  let stradaDueRigheSotto = false;
  for (const dc of [-1, 0, 1] as const) {
    const c2 = col + dc;
    if (c2 < 0 || c2 >= cols) continue;
    if (row + 2 < rows && isStradaCell(row + 2, c2, cols, rows, edificiInMappa)) {
      stradaDueRigheSotto = true;
      break;
    }
  }
  const n = isSandAt(row - 1, col, cols, rows, terrenoInMappa);
  if (stradaDueRigheSotto && !n) {
    return undefined;
  }
  const e = isSandAt(row, col + 1, cols, rows, terrenoInMappa);
  const s = isSandAt(row + 1, col, cols, rows, terrenoInMappa);
  const w = isSandAt(row, col - 1, cols, rows, terrenoInMappa);
  if (n || e || s || w) {
    const mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
    return subtile9FromMask(mask);
  }
  /**
   * Solo sabbia in diagonale (nessun vicino ortogonale sabbia): “angolo interno” nel blocco 3×3.
   * Indici nel foglio grass–sabbia (320,128): NW→6, NE→5, SW→7, SE→8.
   */
  const nw = isSandAt(row - 1, col - 1, cols, rows, terrenoInMappa);
  const ne = isSandAt(row - 1, col + 1, cols, rows, terrenoInMappa);
  const sw = isSandAt(row + 1, col - 1, cols, rows, terrenoInMappa);
  const se = isSandAt(row + 1, col + 1, cols, rows, terrenoInMappa);
  const dCount = (nw ? 1 : 0) + (ne ? 1 : 0) + (sw ? 1 : 0) + (se ? 1 : 0);
  if (dCount !== 1) return undefined;
  if (nw) return 6;
  if (ne) return 5;
  if (sw) return 7;
  if (se) return 8;
  return undefined;
}
