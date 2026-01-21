import { GRID_SIZE, SEA_ROWS, BEACH_ROWS, RIVER_XS } from "../constants";

export type TerrainFns = {
  isRiver: (x: number, y: number) => boolean;
  isSea: (x: number, y: number) => boolean;
  isBeach: (x: number, y: number) => boolean;
};

export type TerrainColors = {
  grass: string;
  sea: string;
  beach: string;
  river: string;
  bridge: string;
  castle: string;
  farm: string;
  house: string;
  illuminatedGrass: string;
};

export const defaultTerrainColors: TerrainColors = {
  grass: "#2f9e44",
  sea: "#1c7ed6",
  beach: "#ffd43b",
  river: "#4dabf7",
  bridge: "#8d5a2b",
  castle: "#495057",
  farm: "#b08900",
  house: "#6c757d",
  illuminatedGrass: "#4ade80"
};

// Funzioni terreno esportate direttamente
export const isSea = (_x: number, y: number) => y >= GRID_SIZE - SEA_ROWS;
export const isBeach = (_x: number, y: number) => y >= GRID_SIZE - SEA_ROWS - BEACH_ROWS && y < GRID_SIZE - SEA_ROWS;
// fiume: attraversa anche la spiaggia ma NON entra nel mare
export const isRiver = (x: number, y: number) => RIVER_XS.includes(x) && y >= 0 && y < GRID_SIZE - SEA_ROWS;

export function makeTerrain({
  gridSize,
  seaRows,
  beachRows,
  riverXs
}: {
  gridSize: number;
  seaRows: number;
  beachRows: number;
  riverXs: number[];
}): TerrainFns {
  const isSeaFn = (_x: number, y: number) => y >= gridSize - seaRows;
  const isBeachFn = (_x: number, y: number) => y >= gridSize - seaRows - beachRows && y < gridSize - seaRows;
  const isRiverFn = (x: number, y: number) => riverXs.includes(x) && y >= 0 && y < gridSize - seaRows;
  return { isRiver: isRiverFn, isSea: isSeaFn, isBeach: isBeachFn };
}

export function makeTerrainColor({
  x,
  y,
  isRiver,
  isSea,
  isBeach,
  isBridge,
  isCastle,
  isFarm,
  isHouse,
  isIlluminated,
  isLight,
  nightOpacity,
  blendHex
}: {
  x: number;
  y: number;
  isRiver: boolean;
  isSea: boolean;
  isBeach: boolean;
  isBridge: boolean;
  isCastle: boolean;
  isFarm: boolean;
  isHouse: boolean;
  isIlluminated: boolean;
  isLight: boolean;
  nightOpacity: number;
  blendHex: (base: string, tint: string, t: number) => string;
}): string {
  const colors = defaultTerrainColors;
  let bg = colors.grass;
  
  if (isSea) bg = colors.sea;
  // Il fiume deve prevalere sulla spiaggia quando attraversa la fascia "beach"
  else if (isRiver && !isBridge) bg = colors.river;
  else if (isBeach) bg = colors.beach;
  else if (isBridge) bg = colors.bridge;
  else if (isCastle) bg = colors.castle;
  else if (isFarm) bg = colors.farm;
  else if (isHouse) bg = colors.house;
  
  // Illuminazione: rende le caselle più chiare
  if (isIlluminated && !isSea && !isBeach && !isRiver && !isCastle && !isFarm && !isHouse) {
    bg = colors.illuminatedGrass;
  }
  
  // Notte per-cella: le luci NON perdono luminosità (illuminated o light sono "immuni")
  if (nightOpacity > 0 && !(isIlluminated || isLight)) {
    // prima tinta blu profonda, poi un tocco viola
    bg = blendHex(bg, "#0b1026", nightOpacity);
    bg = blendHex(bg, "#2b1140", nightOpacity * 0.18);
  }
  
  return bg;
}

