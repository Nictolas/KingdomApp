import { GRID_SIZE, SEA_ROWS, BEACH_ROWS, RIVER_XS } from "../constants";

// Controlla se una cella è fiume
export function isRiver(x: number, y: number, riverCells: number[]): boolean {
  if (y < 0 || y >= riverCells.length) return false;
  const riverX = riverCells[y];
  return x === riverX || x === riverX + 1; // Fiume largo 2 celle
}

// Controlla se una cella è mare
export function isSea(x: number, y: number): boolean {
  return y >= GRID_SIZE - SEA_ROWS;
}

// Controlla se una cella è spiaggia
export function isBeach(x: number, y: number): boolean {
  return y >= GRID_SIZE - SEA_ROWS - BEACH_ROWS && y < GRID_SIZE - SEA_ROWS;
}
