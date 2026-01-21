import { useState } from "react";

type UseHouseAssignmentsReturn = {
  houseAssignments: Record<string, number[]>;
  setHouseAssignments: React.Dispatch<React.SetStateAction<Record<string, number[]>>>;
  assignedCharactersForHouse: (houseId: string) => number[];
  assignToHouse: (houseId: string, charId: number | null) => void;
  reset: () => void;
};

export function useHouseAssignments(): UseHouseAssignmentsReturn {
  const [houseAssignments, setHouseAssignments] = useState<Record<string, number[]>>({
    "house-1": [],
    "house-2": [],
    "house-3": [],
    "house-4": []
  });

  const assignedCharactersForHouse = (houseId: string) => houseAssignments[houseId] ?? [];

  const assignToHouse = (houseId: string, charId: number | null) => {
    setHouseAssignments((prev) => {
      const current = prev[houseId] ?? [];
      if (charId === null) {
        return { ...prev, [houseId]: [] };
      }
      if (current.includes(charId)) {
        return { ...prev, [houseId]: current.filter((id) => id !== charId) };
      }
      if (current.length >= 2) {
        return prev;
      }
      return { ...prev, [houseId]: [...current, charId] };
    });
  };

  const reset = () => {
    setHouseAssignments({ "house-1": [], "house-2": [], "house-3": [], "house-4": [] });
  };

  return {
    houseAssignments,
    setHouseAssignments,
    assignedCharactersForHouse,
    assignToHouse,
    reset
  };
}
