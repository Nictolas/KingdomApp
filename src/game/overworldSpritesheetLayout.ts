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
  /**
   * Erba “piena” (fallback, meno usata se c’è il blocco 2×2).
   * @deprecated preferisci grassDecor2x2Origin
   */
  grassFill: { x: 192, y: 192 },
  /**
   * Motivo erba 2×2: blocco in alto a sinistra nel foglio (sotto i conigli), quattro tile coerenti.
   * Origine = angolo in alto a sinistra del blocco 2×2.
   */
  grassDecor2x2Origin: { x: 0, y: 128 },
  /**
   * Transizioni erba ↔ sabbia (3×3 autotile, stesso ordine indici di spiaggia/strada).
   * Nel foglio DEMO è il blocco a sinistra della terra rossa, y=128.
   */
  grassSand3x3Origin: { x: 320, y: 128 },
  /**
   * Transizioni erba ↔ strada (sentiero menta): celle erba che confinano con una cella “Strada”.
   * Blocco tra il lastricato menta (128,128) e l’erba–sabbia (320,128); stessi indici maschera della sabbia.
   */
  grassRoad3x3Origin: { x: 256, y: 128 },
  /**
   * Strada: lastricato (interno ~#A0D0C0, vicino a #99CDBB), bordo “a nuvola” verso erba.
   * Blocco 3×3 con origine (128, 128) — centro tile indice 4 = riempimento sentiero.
   */
  roadDirt3x3Origin: { x: 128, y: 128 },
  /**
   * Blocco 3×3 spiaggia/sabbia–acqua (angoli, lati, centro).
   */
  beachSand3x3Origin: { x: 768, y: 128 }
} as const;

/** Sottotile 0…8 in un blocco 3×3 con origine nota. */
export function subtile3x3OriginPx(origin: { x: number; y: number }, idx: number): { x: number; y: number } {
  const t = OVERWORLD_SHEET_PX.tile;
  const col = idx % 3;
  const row = Math.floor(idx / 3);
  return { x: origin.x + col * t, y: origin.y + row * t };
}

/** Compat: spiaggia. */
export function beachSubtileOriginPx(idx: number): { x: number; y: number } {
  return subtile3x3OriginPx(OVERWORLD_SHEET_PX.beachSand3x3Origin, idx);
}

/** Strada terra 3×3. */
export function roadSubtileOriginPx(idx: number): { x: number; y: number } {
  return subtile3x3OriginPx(OVERWORLD_SHEET_PX.roadDirt3x3Origin, idx);
}

/** Erba decor 2×2: indice 0=TL,1=TR,2=BL,3=BR. */
export function grass2x2SubtileOriginPx(idx: number): { x: number; y: number } {
  const { x: ox, y: oy } = OVERWORLD_SHEET_PX.grassDecor2x2Origin;
  const t = OVERWORLD_SHEET_PX.tile;
  const col = idx % 2;
  const row = Math.floor(idx / 2);
  return { x: ox + col * t, y: oy + row * t };
}

/** Bordo erba–sabbia: indici 0…8 come negli altri blocchi 3×3. */
export function grassSandSubtileOriginPx(idx: number): { x: number; y: number } {
  return subtile3x3OriginPx(OVERWORLD_SHEET_PX.grassSand3x3Origin, idx);
}

/** Bordo erba–strada: stessi indici di erba–sabbia / strada. */
export function grassRoadSubtileOriginPx(idx: number): { x: number; y: number } {
  return subtile3x3OriginPx(OVERWORLD_SHEET_PX.grassRoad3x3Origin, idx);
}
