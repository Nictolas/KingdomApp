import type { Building } from "./types";

export const GRID_SIZE = 30;
export const NUM_CHARACTERS = 6;
export const CELL_SIZE = 36;
export const CELL_GAP = 3;
export const SEA_ROWS = 3;
export const BEACH_ROWS = 2;
export const LAND_ROWS = GRID_SIZE - SEA_ROWS - BEACH_ROWS;
export const RIVER_XS = [Math.floor(GRID_SIZE / 2) - 1, Math.floor(GRID_SIZE / 2)];

export const professions = [
  { emoji: "👨‍🌾", name: "Contadino" },
  { emoji: "🤴", name: "Re" },
  { emoji: "👨‍🍳", name: "Cuoco" },
  { emoji: "👨‍🔬", name: "Scienziato" },
  { emoji: "👨‍🎨", name: "Artista" },
  { emoji: "🪓", name: "Boscaiolo" }
];

export const firstNames = [
  "Marco",
  "Luca",
  "Giovanni",
  "Paolo",
  "Andrea",
  "Francesco",
  "Alessandro",
  "Matteo",
  "Lorenzo",
  "Giuseppe"
];

export const lastNames = ["Rossi", "Bianchi", "Verdi", "Romano", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti"];

export const castleData: Building = {
  id: "castle",
  x: 23,
  y: 11,
  width: 3,
  height: 3,
  name: "Castello",
  emoji: "🏰",
  description: "Un maestoso castello medievale",
  type: "castle"
};

export const farmData: Building = {
  id: "farm",
  x: 4,
  y: 22,
  width: 3,
  height: 3,
  name: "Campo",
  emoji: "🌾",
  description: "Un campo coltivato per l'agricoltura",
  type: "farm"
};

export const houseData: Building[] = [
  { id: "house-1", x: 7, y: 6, width: 2, height: 2, name: "Casa", emoji: "🏠", description: "Una piccola casa accogliente", type: "house" },
  { id: "house-2", x: 14, y: 6, width: 2, height: 2, name: "Casa", emoji: "🏠", description: "Una casa vicino al fiume", type: "house" },
  { id: "house-3", x: 3, y: 12, width: 2, height: 2, name: "Casa", emoji: "🏠", description: "Una casa immersa nel verde", type: "house" },
  { id: "house-4", x: 22, y: 18, width: 2, height: 2, name: "Casa", emoji: "🏠", description: "Una casa non lontana dal campo", type: "house" }
];
