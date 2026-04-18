import type { TerrenoType } from "./riverGeneration";

/** Direzione in cui si trova l’acqua (fiume o mare) rispetto alla cella sabbia. */
export type SandWaterDirection = "n" | "s" | "e" | "w";

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
 * Per una cella `sabbia`, indica da che lato c’è l’acqua (primo tra N,E,S,W con acqua).
 */
export function getSandWaterDirection(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): SandWaterDirection {
  const col = index % cols;
  const row = Math.floor(index / cols);
  if (isWaterAt(row - 1, col, cols, rows, terrenoInMappa)) return "n";
  if (isWaterAt(row, col + 1, cols, rows, terrenoInMappa)) return "e";
  if (isWaterAt(row + 1, col, cols, rows, terrenoInMappa)) return "s";
  if (isWaterAt(row, col - 1, cols, rows, terrenoInMappa)) return "w";
  return "e";
}
