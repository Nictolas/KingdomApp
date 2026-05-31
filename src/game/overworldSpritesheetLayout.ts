/**
 * Coordinate in pixel sul file spritesheet-full.png (RhosGFX DEMO, 1341×1408).
 * Tile base 64×64. Resta in uso solo per l’acqua animata.
 */
export const OVERWORLD_SHEET_PX = {
  w: 1341,
  h: 1408,
  tile: 64,
  /** Striscia acqua animata: 4 frame orizzontali */
  waterAnimX: 768,
  waterAnimY: 64,
  waterFrames: 4
} as const;
