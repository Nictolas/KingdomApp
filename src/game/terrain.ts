import { GRID_SIZE, SEA_ROWS, BEACH_ROWS, RIVER_XS } from "../constants";

// Generatore di numeri casuali basato su seed
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

// Genera un fiume casuale basato sul seed
export function generateRiver(seed: number): number[] {
  const rng = new SeededRandom(seed);
  const riverCells: number[] = [];
  
  // Il fiume parte da nord e va verso sud
  // Genera un percorso sinuoso
  let currentX = rng.nextInt(GRID_SIZE * 0.3, GRID_SIZE * 0.7); // Parte dal centro-nord
  
  for (let y = 0; y < GRID_SIZE - SEA_ROWS - BEACH_ROWS; y++) {
    // Aggiungi la cella corrente
    riverCells.push(currentX);
    
    // Decidi se andare a sinistra, dritto o destra
    const direction = rng.next();
    if (direction < 0.3 && currentX > 0) {
      // Vai a sinistra
      currentX--;
    } else if (direction > 0.7 && currentX < GRID_SIZE - 1) {
      // Vai a destra
      currentX++;
    }
    // Altrimenti vai dritto (currentX rimane uguale)
  }
  
  return riverCells;
}

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
