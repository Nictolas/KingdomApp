import type { Bridge, Light, Placed } from "../types";
import { isInsideBuilding, buildingCenter } from "../utils";
import { castleData, farmData, houseData } from "../constants";
import { isLightAt, isIlluminatedByAnyLight } from "./lights";
import { isSea, isBeach } from "./terrain";

export function canBuildLightAt({
  x,
  y,
  lights,
  bridges,
  trees,
  mines
}: {
  x: number;
  y: number;
  lights: Light[];
  bridges: Bridge[];
  trees: Placed[];
  mines: Placed[];
}): boolean {
  const isBridge = bridges.some((b) => b.x === x && b.y === y);
  const isTree = trees.some((t) => t.x === x && t.y === y);
  const isMine = mines.some((m) => m.x === x && m.y === y);
  const river = false; // Non controlliamo il fiume qui, lo facciamo nel chiamante se necessario

  return (
    !isInsideBuilding(castleData, x, y) &&
    !isInsideBuilding(farmData, x, y) &&
    !houseData.some((h) => isInsideBuilding(h, x, y)) &&
    !isTree &&
    !isMine &&
    !isLightAt(lights, x, y) &&
    !isSea(x, y) &&
    !isBeach(x, y)
  );
}

export function canBuildBridgeAt({
  x,
  y,
  bridges
}: {
  x: number;
  y: number;
  bridges: Bridge[];
}): boolean {
  const isBridge = bridges.some((b) => b.x === x && b.y === y);
  return !isBridge;
}
