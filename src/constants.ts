import type { Building } from "./types";

// Aumentiamo la mappa di ~10 caselle per lato (totale +20)
export const GRID_SIZE = 70;
export const NUM_CHARACTERS = 6;
export const CELL_SIZE = 36;
export const CELL_GAP = 3;
export const SEA_ROWS = 12;
export const BEACH_ROWS = 4;
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
  // shift +10/+10 per mantenere la scena "centrata" nella nuova griglia
  // x: 30 per evitare il fiume (RIVER_XS = [34, 35]), il castello occupa x: 30-32
  x: 30,
  y: 21,
  width: 3,
  height: 3,
  name: "Castello",
  emoji: "🏰",
  description: "Un maestoso castello medievale",
  type: "castle"
};

export const farmData: Building = {
  id: "farm",
  // shift +10/+10
  x: 14,
  y: 32,
  width: 3,
  height: 3,
  name: "Campo",
  emoji: "🌾",
  description: "Un campo coltivato per l'agricoltura",
  type: "farm"
};

export const houseData: Building[] = [
  // shift +10/+10
  { id: "house-1", x: 17, y: 16, width: 2, height: 2, name: "Casa", emoji: "🏠", description: "Una piccola casa accogliente", type: "house" },
  { id: "house-2", x: 24, y: 16, width: 2, height: 2, name: "Casa", emoji: "🏠", description: "Una casa vicino al fiume", type: "house" },
  { id: "house-3", x: 13, y: 22, width: 2, height: 2, name: "Casa", emoji: "🏠", description: "Una casa immersa nel verde", type: "house" },
  { id: "house-4", x: 32, y: 28, width: 2, height: 2, name: "Casa", emoji: "🏠", description: "Una casa non lontana dal campo", type: "house" }
];
