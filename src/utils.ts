import type { Building, Point, Placed } from "./types";

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function isInsideBuilding(b: Building, x: number, y: number) {
  return x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height;
}

export function buildingCenter(b: Building): Point {
  return { x: b.x + Math.floor(b.width / 2), y: b.y + Math.floor(b.height / 2) };
}

export function isTree(x: number, y: number, trees: Placed[]): boolean {
  return trees.some((t) => t.x === x && t.y === y);
}

export function isMine(x: number, y: number, mines: Placed[]): boolean {
  return mines.some((m) => m.x === x && m.y === y);
}
