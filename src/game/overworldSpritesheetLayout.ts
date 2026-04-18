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
   * Blocco 3×3 spiaggia/sabbia–acqua (angoli, lati, centro). Origine = angolo in alto a sinistra.
   * Righe: TL, T, TR | L, C, R | BL, B, BR
   */
  beachSand3x3Origin: { x: 768, y: 128 }
} as const;

/** Pixel (sx, sy) della sottotile spiaggia indice 0…8 nel blocco 3×3. */
export function beachSubtileOriginPx(idx: number): { x: number; y: number } {
  const { x: ox, y: oy } = OVERWORLD_SHEET_PX.beachSand3x3Origin;
  const t = OVERWORLD_SHEET_PX.tile;
  const col = idx % 3;
  const row = Math.floor(idx / 3);
  return { x: ox + col * t, y: oy + row * t };
}
