import * as Haptics from "expo-haptics";
import type { Character, Point, Bridge, Light, Placed } from "../types";
import { buildingCenter, findPath, isInsideBuilding } from "../utils";
import { castleData, farmData, houseData, RIVER_XS, GRID_SIZE, SEA_ROWS } from "../constants";
import { isRiver, isSea, isBeach } from "./terrain";
import { isTree, isMine } from "../utils";
import { isLightAt } from "./lights";

export function handleCallKing(
  characters: Character[],
  bridges: Bridge[],
  trees: Placed[],
  mines: Placed[],
  setKingPath: (path: Point[]) => void,
  setKingGoingToCastle: (value: boolean) => void,
  setSelectedBuilding: (value: null) => void,
  setSelectedRiver: (value: null) => void,
  setSelectedCharacter: (value: null) => void,
  setUnreachable: (value: { open: boolean; message: string }) => void
) {
  return async () => {
    const king = characters.find((c) => c.profession === "Re");
    if (!king) return;
    const start = { x: Math.round(king.targetX), y: Math.round(king.targetY) };
    const target = buildingCenter(castleData);
    const isBlocked = (p: Point, allowTarget?: Point) => {
      if (allowTarget && p.x === allowTarget.x && p.y === allowTarget.y) return false;
      if (!(p.x >= 0 && p.x < GRID_SIZE && p.y >= 0 && p.y < GRID_SIZE - SEA_ROWS)) return true;
      const isBeachCell = p.y >= GRID_SIZE - SEA_ROWS - 4 && p.y < GRID_SIZE - SEA_ROWS;
      if (isBeachCell && !isRiver(p.x, p.y)) return true;
      if (isRiver(p.x, p.y) && !bridges.some((b) => b.x === p.x && b.y === p.y)) return true;
      if (isTree(p.x, p.y, trees)) return true;
      if (isMine(p.x, p.y, mines)) return true;
      if (isInsideBuilding(castleData, p.x, p.y)) return true;
      if (isInsideBuilding(farmData, p.x, p.y)) return true;
      for (const h of houseData) if (isInsideBuilding(h, p.x, p.y)) return true;
      return false;
    };
    const path = findPath(start, target, isBlocked);
    if (!path) {
      setUnreachable({ open: true, message: "Il Re non può raggiungere il castello." });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setKingPath(path);
    setKingGoingToCastle(true);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    setSelectedCharacter(null);
    await Haptics.selectionAsync();
  };
}

export function handleCallFarmer(
  characters: Character[],
  bridges: Bridge[],
  trees: Placed[],
  mines: Placed[],
  setFarmerPath: (path: Point[]) => void,
  setFarmerGoingToFarm: (value: boolean) => void,
  setSelectedBuilding: (value: null) => void,
  setSelectedRiver: (value: null) => void,
  setSelectedCharacter: (value: null) => void,
  setUnreachable: (value: { open: boolean; message: string }) => void
) {
  return async () => {
    const farmer = characters.find((c) => c.profession === "Contadino");
    if (!farmer) return;
    const start = { x: Math.round(farmer.targetX), y: Math.round(farmer.targetY) };
    const target = buildingCenter(farmData);
    const isBlocked = (p: Point, allowTarget?: Point) => {
      if (allowTarget && p.x === allowTarget.x && p.y === allowTarget.y) return false;
      if (!(p.x >= 0 && p.x < GRID_SIZE && p.y >= 0 && p.y < GRID_SIZE - SEA_ROWS)) return true;
      const isBeachCell = p.y >= GRID_SIZE - SEA_ROWS - 4 && p.y < GRID_SIZE - SEA_ROWS;
      if (isBeachCell && !isRiver(p.x, p.y)) return true;
      if (isRiver(p.x, p.y) && !bridges.some((b) => b.x === p.x && b.y === p.y)) return true;
      if (trees.some((t) => t.x === p.x && t.y === p.y)) return true;
      if (mines.some((m) => m.x === p.x && m.y === p.y)) return true;
      if (isInsideBuilding(castleData, p.x, p.y)) return true;
      if (isInsideBuilding(farmData, p.x, p.y)) return true;
      for (const h of houseData) if (isInsideBuilding(h, p.x, p.y)) return true;
      return false;
    };
    const path = findPath(start, target, isBlocked);
    if (!path) {
      setUnreachable({ open: true, message: "Postazione irraggiungibile: il Contadino non può raggiungere il campo." });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setFarmerPath(path);
    setFarmerGoingToFarm(true);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    setSelectedCharacter(null);
    await Haptics.selectionAsync();
  };
}

export function buildBridge(
  selectedRiver: Point | null,
  setBridges: React.Dispatch<React.SetStateAction<Bridge[]>>,
  setSelectedRiver: (value: null) => void
) {
  return async () => {
    if (!selectedRiver) return;
    setBridges((prev) => {
      const next = [...prev];
      for (const rx of RIVER_XS) {
        if (!next.some((b) => b.x === rx && b.y === selectedRiver.y)) next.push({ x: rx, y: selectedRiver.y });
      }
      return next;
    });
    setSelectedRiver(null);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
}

export function buildBridgeAt(
  x: number,
  y: number,
  setBridges: React.Dispatch<React.SetStateAction<Bridge[]>>
) {
  return async () => {
    if (!isRiver(x, y)) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setBridges((prev) => {
      const next = [...prev];
      for (const rx of RIVER_XS) {
        if (!next.some((b) => b.x === rx && b.y === y)) next.push({ x: rx, y });
      }
      return next;
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
}

export function buildLight(
  x: number,
  y: number,
  buildMode: "light" | "bridge" | null,
  trees: Placed[],
  mines: Placed[],
  lights: Light[],
  setLights: React.Dispatch<React.SetStateAction<Light[]>>
) {
  return async () => {
    if (buildMode !== "light") return;
    
    if (
      isRiver(x, y) ||
      isInsideBuilding(castleData, x, y) ||
      isInsideBuilding(farmData, x, y) ||
      houseData.some((h) => isInsideBuilding(h, x, y)) ||
      isTree(x, y, trees) ||
      isMine(x, y, mines) ||
      isLightAt(lights, x, y) ||
      isSea(x, y) ||
      isBeach(x, y)
    ) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    const newLight: Light = { x, y, id: lights.length };
    setLights((prev) => [...prev, newLight]);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
}
