/**
 * Coordinate in pixel sul file spritesheet-full.png (RhosGFX DEMO, 1341×1408).
 * Striscia acqua animata: 4 tile 64×64 in orizzontale (non è una GIF: si fa loop dei frame).
 */
export const OVERWORLD_SHEET_PX = {
  w: 1341,
  h: 1408,
  waterTile: 64,
  /** Angolo in alto a sinistra del primo frame dell’animazione acqua */
  waterAnimX: 768,
  waterAnimY: 64,
  waterFrames: 4
} as const;
