import type { Placed, Character } from "../types";
import {
  GRID_SIZE,
  NUM_CHARACTERS,
  LAND_ROWS,
  RIVER_XS,
  professions,
  firstNames,
  lastNames,
  castleData,
  farmData,
  houseData
} from "../constants";
import { isRiver } from "./terrain";
import { isInsideBuilding } from "../utils";

export function generateTrees(): Placed[] {
  const treeList: Placed[] = [];
  const numTrees = 45;
  for (let i = 0; i < numTrees; i++) {
    let x = 0;
    let y = 0;
    let attempts = 0;
    do {
      x = Math.floor(Math.random() * GRID_SIZE);
      y = Math.floor(Math.random() * LAND_ROWS);
      attempts++;
    } while (
      attempts < 400 &&
      (isRiver(x, y) ||
        isInsideBuilding(castleData, x, y) ||
        isInsideBuilding(farmData, x, y) ||
        houseData.some((h) => isInsideBuilding(h, x, y)) ||
        treeList.some((t) => t.x === x && t.y === y))
    );
    treeList.push({ x, y });
  }
  return treeList;
}

export function generateMines(): Placed[] {
  const mineList: Placed[] = [];
  const numMines = 8;
  for (let i = 0; i < numMines; i++) {
    let x = 0;
    let y = 0;
    let attempts = 0;
    do {
      x = Math.floor(Math.random() * GRID_SIZE);
      y = Math.floor(Math.random() * LAND_ROWS);
      attempts++;
    } while (
      attempts < 400 &&
      (isRiver(x, y) ||
        isInsideBuilding(castleData, x, y) ||
        isInsideBuilding(farmData, x, y) ||
        houseData.some((h) => isInsideBuilding(h, x, y)) ||
        mineList.some((m) => m.x === x && m.y === y))
    );
    mineList.push({ x, y });
  }
  return mineList;
}

export function generateCharacters(newTrees: Placed[], newMines: Placed[]): Character[] {
  const list: Character[] = [];
  for (let i = 0; i < NUM_CHARACTERS; i++) {
    const profession = professions[i];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    let x = 0;
    let y = 0;
    let attempts = 0;
    do {
      x = Math.floor(Math.random() * GRID_SIZE);
      y = Math.floor(Math.random() * LAND_ROWS);
      attempts++;
    } while (
      attempts < 400 &&
      (isRiver(x, y) ||
        isInsideBuilding(castleData, x, y) ||
        isInsideBuilding(farmData, x, y) ||
        houseData.some((h) => isInsideBuilding(h, x, y)) ||
        newTrees.some((t) => t.x === x && t.y === y) ||
        newMines.some((m) => m.x === x && m.y === y))
    );
    list.push({
      id: i,
      x,
      y,
      targetX: x,
      targetY: y,
      emoji: profession.emoji,
      profession: profession.name,
      name: `${firstName} ${lastName}`,
      age: Math.floor(Math.random() * 50) + 18, // Età tra 18 e 67
      lastMove: Date.now(),
      isInHouse: false
    });
  }
  return list;
}
