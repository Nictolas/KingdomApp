import { GRID_SIZE, LAND_ROWS, SEA_ROWS, BEACH_ROWS } from "../constants";
import type { Placed } from "../types";
import { isRiver, isSea } from "./terrain";

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

// Genera alberi casuali basati sul seed
export function generateTrees(seed: number, riverCells: number[]): Placed[] {
  const rng = new SeededRandom(seed + 1000); // Usa seed diverso per varietà
  const trees: Placed[] = [];
  const numTrees = 45;
  let id = 1;

  for (let i = 0; i < numTrees; i++) {
    let attempts = 0;
    let x = 0;
    let y = 0;
    let valid = false;

    while (attempts < 100 && !valid) {
      x = rng.nextInt(0, GRID_SIZE - 1);
      y = rng.nextInt(0, GRID_SIZE - SEA_ROWS - 1); // Solo sulla terra e spiaggia, non sul mare
      
      // Controlla che non sia fiume o mare
      if (!isRiver(x, y, riverCells) && !isSea(x, y)) {
        // Controlla che non ci sia già un albero qui
        if (!trees.some(t => t.x === x && t.y === y)) {
          valid = true;
        }
      }
      attempts++;
    }

    if (valid) {
      trees.push({ x, y, id: id++ });
    }
  }

  return trees;
}
