import { useState } from "react";
import type { Character } from "../types";

type UseCharacterMovementControlReturn = {
  selectedCharacterId: number | null;
  selectCharacter: (id: number | null) => void;
  handleCellClick: (x: number, y: number, moveCharacter: (id: number, x: number, y: number) => void) => void;
};

export function useCharacterMovementControl(): UseCharacterMovementControlReturn {
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);

  const selectCharacter = (id: number | null) => {
    setSelectedCharacterId(id);
  };

  const handleCellClick = (
    x: number,
    y: number,
    moveCharacter: (id: number, x: number, y: number) => void
  ) => {
    if (selectedCharacterId !== null) {
      moveCharacter(selectedCharacterId, x, y);
      setSelectedCharacterId(null); // Deseleziona dopo il movimento
    }
  };

  return {
    selectedCharacterId,
    selectCharacter,
    handleCellClick
  };
}
