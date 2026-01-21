import { Dimensions } from "react-native";
import type { Camera } from "../camera/useCamera";
import { generateTrees, generateMines, generateCharacters } from "./generation";
import type { Placed, Character } from "../types";

type ResetOptions = {
  camera: Camera;
  setTrees: (trees: Placed[]) => void;
  setMines: (mines: Placed[]) => void;
  setCharacters: (characters: Character[]) => void;
  resetWorld: () => void;
  resetSelections: () => void;
  resetClock: () => void;
  resetHouseAssignments: () => void;
};

export function resetGame(options: ResetOptions) {
  const { camera, setTrees, setMines, setCharacters, resetWorld, resetSelections, resetClock, resetHouseAssignments } = options;

  resetSelections();
  resetWorld();
  resetClock();
  resetHouseAssignments();

  // Reset offset a (0,0) - la camera si resetta automaticamente
  camera.pan(-camera.offset.x, -camera.offset.y);

  const newTrees = generateTrees();
  const newMines = generateMines();
  setTrees(newTrees);
  setMines(newMines);
  setCharacters(generateCharacters(newTrees, newMines));
}
