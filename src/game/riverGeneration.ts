import { GRID_SIZE, SEA_ROWS, BEACH_ROWS } from "../constants";

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

/**
 * Genera un fiume casuale basato sul seed.
 * Il fiume parte da nord e attraversa la terra fino alla spiaggia.
 */
export function generateRiver(seed: number): number[] {
  const rng = new SeededRandom(seed);
  const riverCells: number[] = [];
  
  // Il fiume parte da nord e va verso sud
  // Genera un percorso sinuoso
  let currentX = rng.nextInt(GRID_SIZE * 0.3, GRID_SIZE * 0.7); // Parte dal centro-nord
  
  // Il fiume attraversa tutta la terra fino alla spiaggia
  const landEndY = GRID_SIZE - SEA_ROWS - BEACH_ROWS;
  for (let y = 0; y < landEndY; y++) {
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

/**
 * Estende il fiume attraverso la spiaggia fino al mare.
 * Questa funzione viene chiamata dopo la generazione del mondo base
 * per garantire che il fiume raggiunga sempre il mare.
 */
export function extendRiverToSea(riverCells: number[]): number[] {
  if (riverCells.length === 0) return riverCells;
  
  const extendedRiver = [...riverCells];
  const landEndY = GRID_SIZE - SEA_ROWS - BEACH_ROWS;
  const lastRiverX = riverCells[riverCells.length - 1];
  
  // Estendi il fiume attraverso la spiaggia (mantieni la stessa X)
  // La spiaggia va da landEndY a GRID_SIZE - SEA_ROWS
  for (let y = landEndY; y < GRID_SIZE - SEA_ROWS; y++) {
    extendedRiver.push(lastRiverX);
  }
  
  // Estendi il fiume nel mare - continua fino alla fine della griglia
  // Il fiume deve arrivare fino al fondo del mare
  const seaStartY = GRID_SIZE - SEA_ROWS;
  for (let y = seaStartY; y < GRID_SIZE; y++) {
    extendedRiver.push(lastRiverX);
  }
  
  return extendedRiver;
}
