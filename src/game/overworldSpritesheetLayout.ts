/**
 * Coordinate in pixel sul file spritesheet-full.png (RhosGFX DEMO, 1341×1408).
 * Tile base 64×64 (stesso della striscia acqua).
 */
export const OVERWORLD_SHEET_PX = {
  w: 1341,
  h: 1408,
  tile: 64,
  /** Striscia acqua animata: 4 frame orizzontali */
  waterAnimX: 768,
  waterAnimY: 64,
  waterFrames: 4,
  /** Riempimento erba (tile “piena” zona autotile) */
  grassFill: { x: 192, y: 192 },
  /** Sabbia / spiaggia (tile piena vicino all’acqua nel foglio) */
  sandFill: { x: 896, y: 192 }
} as const;
