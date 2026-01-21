export type Point = { x: number; y: number };
export type Placed = { x: number; y: number; id: number };
export type Bridge = { x: number; y: number };
export type Light = { x: number; y: number; id: number };

export type BuildingType = "castle" | "farm" | "house";

export type Building = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  emoji: string;
  description: string;
  type: BuildingType;
};

export type Character = {
  id: number;
  x: number; // float per animazione
  y: number; // float per animazione
  targetX: number; // intero (griglia)
  targetY: number; // intero (griglia)
  emoji: string;
  profession: string;
  name: string;
  age: number;
  lastMove: number;
  isInCastle?: boolean;
  isInFarm?: boolean;
  isInHouse?: boolean;
};
