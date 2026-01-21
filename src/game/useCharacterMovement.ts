import { useEffect } from "react";
import type { Character, Point, Placed, Bridge, Building } from "../types";
import { buildingCenter, findPath } from "../utils";
import { castleData, farmData, houseData } from "../constants";
import { isRiver, isBeach } from "./terrain";
import { isTree, isMine, isInsideBuilding } from "../utils";
import { GRID_SIZE, SEA_ROWS, castleData, farmData, houseData } from "../constants";

type UseCharacterMovementOptions = {
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  bridges: Bridge[];
  trees: Placed[];
  mines: Placed[];
  kingGoingToCastle: boolean;
  setKingGoingToCastle: (value: boolean) => void;
  farmerGoingToFarm: boolean;
  setFarmerGoingToFarm: (value: boolean) => void;
  kingPath: Point[];
  setKingPath: (path: Point[]) => void;
  farmerPath: Point[];
  setFarmerPath: (path: Point[]) => void;
  setUnreachable: (value: { open: boolean; message: string }) => void;
  isNight: boolean;
  houseAssignments: Record<string, number[]>;
};

export function useCharacterMovement({
  characters,
  setCharacters,
  bridges,
  trees,
  mines,
  kingGoingToCastle,
  setKingGoingToCastle,
  farmerGoingToFarm,
  setFarmerGoingToFarm,
  kingPath,
  setKingPath,
  farmerPath,
  setFarmerPath,
  setUnreachable,
  isNight,
  houseAssignments
}: UseCharacterMovementOptions) {
  // Animazione verso target (smooth)
  useEffect(() => {
    const anim = setInterval(() => {
      setCharacters((prev) =>
        prev.map((c) => {
          const dx = c.targetX - c.x;
          const dy = c.targetY - c.y;
          const speed = 0.08;
          if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return { ...c, x: c.targetX, y: c.targetY };
          return { ...c, x: c.x + dx * speed, y: c.y + dy * speed };
        })
      );
    }, 16);
    return () => clearInterval(anim);
  }, [setCharacters]);

  // Movimento "a scatti" (sempre su interi) + script Re/Contadino + notte in casa
  useEffect(() => {
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

    const stepAlongPath = (from: Point, path: Point[]) => {
      const idx = path.findIndex((p) => p.x === from.x && p.y === from.y);
      if (idx >= 0 && idx < path.length - 1) return path[idx + 1];
      return null;
    };

    const getAssignedHouse = (charId: number): Building | null => {
      const houseId = Object.entries(houseAssignments).find(([, v]) => Array.isArray(v) && v.includes(charId))?.[0];
      if (!houseId) return null;
      return houseData.find((h) => h.id === houseId) ?? null;
    };

    const interval = setInterval(() => {
      setCharacters((prev) => {
        const byId = new Map(prev.map((c) => [c.id, c]));
        return prev.map((char) => {
          const now = Date.now();
          const gridPos = { x: Math.round(char.targetX), y: Math.round(char.targetY) };

          // Giorno: escono dalla casa
          if (!isNight && char.isInHouse) {
            return { ...char, isInHouse: false, lastMove: now };
          }

          // Notte: gli abitanti assegnati vanno in casa e restano dentro
          const assignedHouse = getAssignedHouse(char.id);
          if (isNight && assignedHouse) {
            const target = buildingCenter(assignedHouse);
            if (gridPos.x === target.x && gridPos.y === target.y) {
              return { ...char, isInHouse: true, lastMove: now, targetX: target.x, targetY: target.y };
            }
            if (char.isInHouse) return char;
            const path = findPath(gridPos, target, isBlocked);
            if (!path) return char;
            const next = stepAlongPath(gridPos, path);
            if (!next) return char;
            return { ...char, targetX: next.x, targetY: next.y, lastMove: now, isInHouse: false };
          }

          // Se dentro castello/campo resta fermo
          if (char.isInCastle || char.isInFarm) return char;

          // Delay
          const timeSince = now - char.lastMove;
          const moveDelay = 1600 + char.id * 160;
          if (timeSince < moveDelay) return char;

          // Re -> castello (BFS)
          if (char.profession === "Re" && kingGoingToCastle) {
            const target = buildingCenter(castleData);
            if (gridPos.x === target.x && gridPos.y === target.y) {
              setKingGoingToCastle(false);
              setKingPath([]);
              return { ...char, targetX: target.x, targetY: target.y, x: target.x, y: target.y, isInCastle: true, lastMove: now };
            }
            const path = kingPath.length ? kingPath : findPath(gridPos, target, isBlocked);
            if (!path) {
              setKingGoingToCastle(false);
              setKingPath([]);
              setUnreachable({ open: true, message: "Il Re non può raggiungere il castello." });
              return char;
            }
            if (!kingPath.length) setKingPath(path);
            const next = stepAlongPath(gridPos, path);
            if (!next) return { ...char, lastMove: now };
            return { ...char, targetX: next.x, targetY: next.y, lastMove: now };
          }

          // Contadino -> campo (BFS)
          if (char.profession === "Contadino" && farmerGoingToFarm) {
            const target = buildingCenter(farmData);
            if (gridPos.x === target.x && gridPos.y === target.y) {
              setFarmerGoingToFarm(false);
              setFarmerPath([]);
              return { ...char, targetX: target.x, targetY: target.y, x: target.x, y: target.y, isInFarm: true, lastMove: now };
            }
            const path = farmerPath.length ? farmerPath : findPath(gridPos, target, isBlocked);
            if (!path) {
              setFarmerGoingToFarm(false);
              setFarmerPath([]);
              setUnreachable({ open: true, message: "Postazione irraggiungibile: il Contadino non può raggiungere il campo." });
              return char;
            }
            if (!farmerPath.length) setFarmerPath(path);
            const next = stepAlongPath(gridPos, path);
            if (!next) return { ...char, lastMove: now };
            return { ...char, targetX: next.x, targetY: next.y, lastMove: now };
          }

          // Movimento casuale: usa SOLO coordinate intere e non entra in fiume senza ponte / alberi / miniere
          const dirs = [
            { x: 0, y: -1 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 1, y: 0 }
          ].sort(() => Math.random() - 0.5);

          for (const d of dirs) {
            const np = { x: gridPos.x + d.x, y: gridPos.y + d.y };
            if (isBlocked(np)) continue;
            return { ...char, targetX: np.x, targetY: np.y, lastMove: now };
          }

          return { ...char, lastMove: now };
        });
      });
    }, 450);

    return () => clearInterval(interval);
  }, [
    bridges,
    trees,
    mines,
    kingGoingToCastle,
    farmerGoingToFarm,
    kingPath,
    farmerPath,
    isNight,
    houseAssignments,
    setCharacters,
    setKingGoingToCastle,
    setFarmerGoingToFarm,
    setKingPath,
    setFarmerPath,
    setUnreachable
  ]);

  // Ricalcolo percorsi quando cambiano ponti
  useEffect(() => {
    if (farmerGoingToFarm) {
      const farmer = characters.find((c) => c.profession === "Contadino");
      if (farmer && !farmer.isInFarm) {
        const start = { x: Math.round(farmer.targetX), y: Math.round(farmer.targetY) };
        const target = buildingCenter(farmData);
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
        if (path) setFarmerPath(path);
      }
    }
    if (kingGoingToCastle) {
      const king = characters.find((c) => c.profession === "Re");
      if (king && !king.isInCastle) {
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
        if (path) setKingPath(path);
      }
    }
  }, [bridges, characters, farmerGoingToFarm, kingGoingToCastle, setFarmerPath, setKingPath]);
}
