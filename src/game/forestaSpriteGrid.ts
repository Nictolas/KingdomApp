/**
 * Impaginazione pixel-art stile avventura classica: alberi singoli e distinti.
 * Tre file regolari, ogni albero occupa il proprio rettangolo senza sovrapporsi.
 */
export type AlberoForestaGrid = {
  x: number;
  y: number;
  width: number;
  height: number;
  variante: 0 | 1;
};

export function layoutNorthernForestTrees(width: number, cellSize: number): AlberoForestaGrid[] {
  if (!(width > 0) || !(cellSize > 0)) return [];
  const rows = 3;
  const columns = Math.max(1, Math.ceil(width / (cellSize * 1.25)));
  const pitchX = width / columns;
  const pitchY = cellSize * 2;
  const treeW = pitchX * 0.96;
  // Quasi tutta l'altezza della fila: chiome e tronchi restano separati, senza fasce vuote.
  const treeH = pitchY * 0.99;
  const trees: AlberoForestaGrid[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      trees.push({
        x: col * pitchX + (pitchX - treeW) / 2,
        y: row * pitchY + (pitchY - treeH) / 2,
        width: treeW,
        height: treeH,
        variante: ((col * 17 + row * 7) % 5 < 3 ? 0 : 1)
      });
    }
  }
  return trees;
}

/** Ignora il margine trasparente dell'immagine: nessuna sovrapposizione tra alberi. */
export function ritaglioAlphaAlbero(
  pixel: Uint8ClampedArray, width: number, height: number
): { x: number; y: number; width: number; height: number } {
  const intero = { x: 0, y: 0, width, height };
  if (width <= 0 || height <= 0 || pixel.length < width * height * 4) return intero;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixel[(y * width + x) * 4 + 3]! < 16) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left) return intero;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
