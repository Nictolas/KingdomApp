import type { Character } from "../types";
import { handleCallKing, handleCallFarmer } from "../game/actions";
import type { Bridge, Placed, Point } from "../types";

type UseCharacterActionsReturn = {
  handleCallKingFn: () => Promise<void>;
  handleCallFarmerFn: () => Promise<void>;
};

type UseCharacterActionsOptions = {
  characters: Character[];
  bridges: Bridge[];
  trees: Placed[];
  mines: Placed[];
  setKingPath: (path: Point[]) => void;
  setKingGoingToCastle: (value: boolean) => void;
  setFarmerPath: (path: Point[]) => void;
  setFarmerGoingToFarm: (value: boolean) => void;
  setSelectedBuilding: (value: null) => void;
  setSelectedRiver: (value: null) => void;
  setSelectedCharacter: (value: null) => void;
  setUnreachable: (value: { open: boolean; message: string }) => void;
};

export function useCharacterActions(options: UseCharacterActionsOptions): UseCharacterActionsReturn {
  const {
    characters,
    bridges,
    trees,
    mines,
    setKingPath,
    setKingGoingToCastle,
    setFarmerPath,
    setFarmerGoingToFarm,
    setSelectedBuilding,
    setSelectedRiver,
    setSelectedCharacter,
    setUnreachable
  } = options;

  const handleCallKingFn = handleCallKing(
    characters,
    bridges,
    trees,
    mines,
    setKingPath,
    setKingGoingToCastle,
    setSelectedBuilding,
    setSelectedRiver,
    setSelectedCharacter,
    setUnreachable
  );

  const handleCallFarmerFn = handleCallFarmer(
    characters,
    bridges,
    trees,
    mines,
    setFarmerPath,
    setFarmerGoingToFarm,
    setSelectedBuilding,
    setSelectedRiver,
    setSelectedCharacter,
    setUnreachable
  );

  return { handleCallKingFn, handleCallFarmerFn };
}
