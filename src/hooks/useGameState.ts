import { useState } from "react";
import type { Bridge, Light, Placed, Point } from "../types";

type UseGameStateReturn = {
  bridges: Bridge[];
  setBridges: React.Dispatch<React.SetStateAction<Bridge[]>>;
  trees: Placed[];
  setTrees: React.Dispatch<React.SetStateAction<Placed[]>>;
  mines: Placed[];
  setMines: React.Dispatch<React.SetStateAction<Placed[]>>;
  lights: Light[];
  setLights: React.Dispatch<React.SetStateAction<Light[]>>;
  buildMode: "light" | "bridge" | null;
  setBuildMode: (mode: "light" | "bridge" | null) => void;
  buildMenuOpen: boolean;
  setBuildMenuOpen: (open: boolean) => void;
  kingGoingToCastle: boolean;
  setKingGoingToCastle: (value: boolean) => void;
  farmerGoingToFarm: boolean;
  setFarmerGoingToFarm: (value: boolean) => void;
  kingPath: Point[];
  setKingPath: (path: Point[]) => void;
  farmerPath: Point[];
  setFarmerPath: (path: Point[]) => void;
  unreachable: { open: boolean; message: string };
  setUnreachable: (value: { open: boolean; message: string }) => void;
  isBridge: (x: number, y: number) => boolean;
  resetWorld: () => void;
};

export function useGameState(): UseGameStateReturn {
  const [bridges, setBridges] = useState<Bridge[]>([]);
  const [trees, setTrees] = useState<Placed[]>([]);
  const [mines, setMines] = useState<Placed[]>([]);
  const [lights, setLights] = useState<Light[]>([]);
  const [buildMode, setBuildMode] = useState<"light" | "bridge" | null>(null);
  const [buildMenuOpen, setBuildMenuOpen] = useState(false);
  const [kingGoingToCastle, setKingGoingToCastle] = useState(false);
  const [farmerGoingToFarm, setFarmerGoingToFarm] = useState(false);
  const [kingPath, setKingPath] = useState<Point[]>([]);
  const [farmerPath, setFarmerPath] = useState<Point[]>([]);
  const [unreachable, setUnreachable] = useState<{ open: boolean; message: string }>({ open: false, message: "" });

  const isBridge = (x: number, y: number) => bridges.some((b: Bridge) => b.x === x && b.y === y);

  const resetWorld = () => {
    setBridges([]);
    setLights([]);
    setBuildMode(null);
    setKingGoingToCastle(false);
    setFarmerGoingToFarm(false);
    setKingPath([]);
    setFarmerPath([]);
    setUnreachable({ open: false, message: "" });
  };

  return {
    bridges,
    setBridges,
    trees,
    setTrees,
    mines,
    setMines,
    lights,
    setLights,
    buildMode,
    setBuildMode,
    buildMenuOpen,
    setBuildMenuOpen,
    kingGoingToCastle,
    setKingGoingToCastle,
    farmerGoingToFarm,
    setFarmerGoingToFarm,
    kingPath,
    setKingPath,
    farmerPath,
    setFarmerPath,
    unreachable,
    setUnreachable,
    isBridge,
    resetWorld
  };
}
