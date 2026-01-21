import type { Character, Building, Point } from "../types";
import { GRID_SIZE } from "../constants";
import { isRiver } from "./terrain";

/**
 * Controlla se due personaggi sono nel raggio 5x5
 */
export function isInRange(char1: Character, char2: Character): boolean {
  const dx = Math.abs(char1.x - char2.x);
  const dy = Math.abs(char1.y - char2.y);
  return dx <= 2.5 && dy <= 2.5; // Raggio 5x5 = 2.5 celle in ogni direzione
}

/**
 * Trova il personaggio più vicino nel raggio
 */
export function findNearestInRange(
  char: Character,
  allChars: Character[],
  isTarget: (c: Character) => boolean
): Character | null {
  let nearest: Character | null = null;
  let minDistance = Infinity;

  for (const other of allChars) {
    if (other.id === char.id) continue;
    if (!isTarget(other)) continue;
    if (!isInRange(char, other)) continue;

    const dx = char.x - other.x;
    const dy = char.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      minDistance = distance;
      nearest = other;
    }
  }

  return nearest;
}

/**
 * Controlla se un personaggio è dentro un edificio
 */
export function isInsideBuilding(char: Character, buildings: Building[]): boolean {
  const charX = Math.round(char.x);
  const charY = Math.round(char.y);

  for (const building of buildings) {
    if (
      charX >= building.x &&
      charX < building.x + building.width &&
      charY >= building.y &&
      charY < building.y + building.height
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Trova l'edificio più vicino nel raggio 5x5
 */
export function findNearestBuildingInRange(
  char: Character,
  buildings: Building[],
  riverCells: number[],
  isBlocked: (x: number, y: number) => boolean
): Building | null {
  let nearest: Building | null = null;
  let minDistance = Infinity;

  for (const building of buildings) {
    // Calcola il centro dell'edificio
    const centerX = building.x + building.width / 2;
    const centerY = building.y + building.height / 2;

    // Calcola la distanza dal personaggio
    const dx = char.x - centerX;
    const dy = char.y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Controlla se è nel raggio 5x5 (2.5 celle)
    if (distance <= 2.5 && distance < minDistance) {
      // Controlla se c'è almeno una cella dell'edificio raggiungibile (non sul fiume)
      let hasReachableCell = false;
      for (let bx = building.x; bx < building.x + building.width; bx++) {
        for (let by = building.y; by < building.y + building.height; by++) {
          if (!isRiver(bx, by, riverCells) && !isBlocked(bx, by)) {
            hasReachableCell = true;
            break;
          }
        }
        if (hasReachableCell) break;
      }

      if (hasReachableCell) {
        minDistance = distance;
        nearest = building;
      }
    }
  }

  return nearest;
}

/**
 * Ottiene una posizione dentro un edificio per rifugiarsi
 */
export function getBuildingEntryPoint(
  building: Building,
  char: Character,
  riverCells: number[],
  isBlocked: (x: number, y: number) => boolean
): Point | null {
  // Prova le celle dell'edificio, iniziando dai bordi
  const entryPoints: Point[] = [];

  // Bordi dell'edificio (priorità)
  for (let bx = building.x; bx < building.x + building.width; bx++) {
    entryPoints.push({ x: bx, y: building.y }); // Bordo superiore
    entryPoints.push({ x: bx, y: building.y + building.height - 1 }); // Bordo inferiore
  }
  for (let by = building.y; by < building.y + building.height; by++) {
    entryPoints.push({ x: building.x, y: by }); // Bordo sinistro
    entryPoints.push({ x: building.x + building.width - 1, y: by }); // Bordo destro
  }

  // Centro dell'edificio
  const centerX = building.x + Math.floor(building.width / 2);
  const centerY = building.y + Math.floor(building.height / 2);
  entryPoints.push({ x: centerX, y: centerY });

  // Prova le posizioni in ordine
  for (const pos of entryPoints) {
    if (!isRiver(pos.x, pos.y, riverCells) && !isBlocked(pos.x, pos.y)) {
      return pos;
    }
  }

  return null;
}

/**
 * Controlla se l'Orco può entrare in una posizione (non può entrare negli edifici)
 */
export function canOrcEnter(x: number, y: number, buildings: Building[]): boolean {
  // Controlla se la posizione è dentro un edificio
  for (const building of buildings) {
    if (
      x >= building.x &&
      x < building.x + building.width &&
      y >= building.y &&
      y < building.y + building.height
    ) {
      return false; // L'Orco non può entrare negli edifici
    }
  }
  return true;
}
