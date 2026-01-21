import type { Character, Point, Bridge, Light, Placed } from "../types";
import { buildingCenter, findPath, isInsideBuilding } from "../utils";
import { castleData, farmData, houseData, RIVER_XS } from "../constants";
import { isRiver, isSea, isBeach } from "./terrain";
import { isTree, isMine } from "../utils";
import { isLightAt } from "./lights";
import { createIsBlocked } from "./pathfinding";
import { safeHapticSelection, safeHapticNotification } from "../utils/haptics";
import * as Haptics from "expo-haptics";

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
    const isBlocked = createIsBlocked(bridges, trees, mines, target);
    const path = findPath(start, target, isBlocked);
    if (!path) {
      setUnreachable({ open: true, message: "Il Re non può raggiungere il castello." });
      await safeHapticNotification(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setKingPath(path);
    setKingGoingToCastle(true);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    setSelectedCharacter(null);
    await safeHapticSelection();
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
    const isBlocked = createIsBlocked(bridges, trees, mines, target);
    const path = findPath(start, target, isBlocked);
    if (!path) {
      setUnreachable({ open: true, message: "Postazione irraggiungibile: il Contadino non può raggiungere il campo." });
      await safeHapticNotification(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setFarmerPath(path);
    setFarmerGoingToFarm(true);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    setSelectedCharacter(null);
    await safeHapticSelection();
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
      await safeHapticNotification(Haptics.NotificationFeedbackType.Success);
  };
}

export function buildBridgeAt(
  x: number,
  y: number,
  setBridges: React.Dispatch<React.SetStateAction<Bridge[]>>
) {
  return async () => {
    if (!isRiver(x, y)) {
      await safeHapticNotification(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setBridges((prev) => {
      const next = [...prev];
      for (const rx of RIVER_XS) {
        if (!next.some((b) => b.x === rx && b.y === y)) next.push({ x: rx, y });
      }
      return next;
    });
      await safeHapticNotification(Haptics.NotificationFeedbackType.Success);
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
      await safeHapticNotification(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    const newLight: Light = { x, y, id: lights.length };
    setLights((prev) => [...prev, newLight]);
      await safeHapticNotification(Haptics.NotificationFeedbackType.Success);
  };
}
