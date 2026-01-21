import type { Point, Bridge, Placed } from "../types";
import { GRID_SIZE, SEA_ROWS, castleData, farmData, houseData } from "../constants";
import { isRiver, isBeach } from "./terrain";
import { isTree, isMine, isInsideBuilding } from "../utils";

export type IsBlockedFunction = (p: Point, allowTarget?: Point) => boolean;

export function createIsBlocked(
  bridges: Bridge[],
  trees: Placed[],
  mines: Placed[],
  allowTarget?: Point
): IsBlockedFunction {
  return (p: Point, allowTargetParam?: Point) => {
    const target = allowTargetParam ?? allowTarget;
    if (target && p.x === target.x && p.y === target.y) return false;
    if (!(p.x >= 0 && p.x < GRID_SIZE && p.y >= 0 && p.y < GRID_SIZE - SEA_ROWS)) return true;
    const isBeachCell = p.y >= GRID_SIZE - SEA_ROWS - 4 && p.y < GRID_SIZE - SEA_ROWS;
    if (isBeachCell && !isRiver(p.x, p.y)) return true;
    if (isRiver(p.x, p.y) && !bridges.some((b) => b.x === p.x && b.y === p.y)) return true;
    if (isTree(p.x, p.y, trees)) return true;
    if (isMine(p.x, p.y, mines)) return true;
    if (isInsideBuilding(castleData, p.x, p.y)) return true;
    if (isInsideBuilding(farmData, p.x, p.y)) return true;
    for (const h of houseData) {
      if (isInsideBuilding(h, p.x, p.y)) return true;
    }
    return false;
  };
}
