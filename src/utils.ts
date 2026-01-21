import type { Building, Point, Placed } from "./types";
import { GRID_SIZE, SEA_ROWS, castleData, farmData, houseData } from "./constants";
import { isRiver, isBeach } from "./game/terrain";

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

export function findPath(
  start: Point,
  target: Point,
  isBlocked: (p: Point, allowTarget?: Point) => boolean
): Point[] | null {
  const q: Array<{ p: Point; path: Point[] }> = [{ p: start, path: [] }];
  const visited = new Set<string>();
  const dirs = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 }
  ];
  while (q.length) {
    const cur = q.shift()!;
    const key = `${cur.p.x},${cur.p.y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (cur.p.x === target.x && cur.p.y === target.y) return [...cur.path, cur.p];
    for (const d of dirs) {
      const np = { x: cur.p.x + d.x, y: cur.p.y + d.y };
      const nKey = `${np.x},${np.y}`;
      if (visited.has(nKey)) continue;
      if (isBlocked(np, target)) continue;
      q.push({ p: np, path: [...cur.path, cur.p] });
    }
  }
  return null;
}
