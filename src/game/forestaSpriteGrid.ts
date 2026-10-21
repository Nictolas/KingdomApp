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
  const treeH = pitchY * 0.96;
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
