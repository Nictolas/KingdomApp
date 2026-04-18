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

/**
 * Indice 0…8 nel blocco 3×3 dello spritesheet (righe: TL,T,TR / L,C,R / BL,B,BR).
 */
export type BeachSubtileIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Autotile spiaggia: in base ai 4 vicini cardinali con acqua (fiume o mare),
 * sceglie la tile corretta nel blocco 3×3 del tileset.
 */
export function getSandBeachSubtile(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): BeachSubtileIndex {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const n = isWaterAt(row - 1, col, cols, rows, terrenoInMappa);
  const e = isWaterAt(row, col + 1, cols, rows, terrenoInMappa);
  const s = isWaterAt(row + 1, col, cols, rows, terrenoInMappa);
  const w = isWaterAt(row, col - 1, cols, rows, terrenoInMappa);
  const mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);

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
