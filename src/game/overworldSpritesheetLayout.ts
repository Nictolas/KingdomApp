/**
 * Coordinate in pixel sul file spritesheet-full.png (RhosGFX DEMO, 1341×1408).
 * Tile base 64×64.
 */
export const OVERWORLD_SHEET_PX = {
  w: 1341,
  h: 1408,
  tile: 64,
  /** Striscia acqua animata: 4 frame orizzontali */
  waterAnimX: 768,
  waterAnimY: 64,
  waterFrames: 4,
  /** Riempimento erba (tile “piena”) */
  grassFill: { x: 192, y: 192 },
  /**
   * Spiaggia: due tile nella fila sotto l’acqua (y=128), NON intercambiabili.
   * - shoreWest: acqua sul bordo sinistro del riquadro → usare quando il fiume/mare è a OVEST della cella.
   * - shoreEast: acqua sul bordo destro → fiume/mare a EST.
   */
  sandShoreWest: { x: 832, y: 128 },
  sandShoreEast: { x: 896, y: 128 }
} as const;
