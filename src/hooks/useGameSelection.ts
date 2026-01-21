import { useState } from "react";
import * as Haptics from "expo-haptics";
import type { Character, Building, Point } from "../types";

type UseGameSelectionReturn = {
  selectedCharacter: Character | null;
  setSelectedCharacter: (char: Character | null) => void;
  selectedBuilding: Building | null;
  setSelectedBuilding: (building: Building | null) => void;
  selectedRiver: Point | null;
  setSelectedRiver: (river: Point | null) => void;
  openCharacter: (char: Character, wasRecentlyDragging: () => boolean) => Promise<void>;
  openBuilding: (building: Building, wasRecentlyDragging: () => boolean) => Promise<void>;
  selectRiver: (x: number, y: number, wasRecentlyDragging: () => boolean, isRiver: (x: number, y: number) => boolean, isBridge: (x: number, y: number) => boolean) => Promise<void>;
  closeModal: () => void;
};

export function useGameSelection(): UseGameSelectionReturn {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedRiver, setSelectedRiver] = useState<Point | null>(null);

  const openCharacter = async (char: Character, wasRecentlyDragging: () => boolean) => {
    if (wasRecentlyDragging()) return;
    setSelectedCharacter(char);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    await Haptics.selectionAsync();
  };

  const openBuilding = async (building: Building, wasRecentlyDragging: () => boolean) => {
    if (wasRecentlyDragging()) return;
    setSelectedBuilding(building);
    setSelectedCharacter(null);
    setSelectedRiver(null);
    await Haptics.selectionAsync();
  };

  const selectRiver = async (
    x: number,
    y: number,
    wasRecentlyDragging: () => boolean,
    isRiver: (x: number, y: number) => boolean,
    isBridge: (x: number, y: number) => boolean
  ) => {
    if (wasRecentlyDragging()) return;
    if (!isRiver(x, y) || isBridge(x, y)) return;
    setSelectedRiver({ x, y });
    setSelectedBuilding(null);
    setSelectedCharacter(null);
    await Haptics.selectionAsync();
  };

  const closeModal = () => {
    setSelectedCharacter(null);
    setSelectedBuilding(null);
    setSelectedRiver(null);
  };

  return {
    selectedCharacter,
    setSelectedCharacter,
    selectedBuilding,
    setSelectedBuilding,
    selectedRiver,
    setSelectedRiver,
    openCharacter,
    openBuilding,
    selectRiver,
    closeModal
  };
}
