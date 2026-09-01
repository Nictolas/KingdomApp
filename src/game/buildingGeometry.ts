export type CellRect = { col: number; row: number; width: number; height: number };
export type CellPoint = { x: number; y: number; cell: number };

export type BuildingGeometry = {
  footprint: CellRect;
  doorway: CellRect;
  doorCell: number;
  entryPoint: CellPoint;
  interiorSpawnPoint: CellPoint;
  collisionAreas: readonly CellRect[];
  overlayArea: CellRect;
  depthOrigin: { x: number; y: number };
};

/** Geometria runtime derivata dal footprint: non modifica il formato dei salvataggi. */
export function deriveBuildingGeometry(anchor: number, widthCells: number, heightCells: number, cols: number, rows: number): BuildingGeometry {
  const col = anchor % cols;
  const row = Math.floor(anchor / cols);
  const width = Math.max(1, Math.min(widthCells, cols - col));
  const height = Math.max(1, Math.min(heightCells, rows - row));
  const doorCol = col + Math.floor(width / 2);
  const doorRow = row + height - 1;
  const exteriorRow = Math.min(rows - 1, doorRow + 1);
  const doorWidth = Math.min(0.72, width);
  const doorLeft = doorCol + (1 - doorWidth) / 2;
  const rightStart = doorLeft + doorWidth;
  const collisionAreas: CellRect[] = [];
  if (height > 1) collisionAreas.push({ col, row, width, height: height - 1 });
  if (doorLeft - col > 0.01) collisionAreas.push({ col, row: doorRow, width: doorLeft - col, height: 1 });
  if (col + width - rightStart > 0.01) collisionAreas.push({ col: rightStart, row: doorRow, width: col + width - rightStart, height: 1 });
  return {
    footprint: { col, row, width, height },
    doorway: { col: doorLeft, row: doorRow, width: doorWidth, height: 1 },
    doorCell: doorRow * cols + doorCol,
    entryPoint: { x: doorCol + 0.5, y: exteriorRow + 0.5, cell: exteriorRow * cols + doorCol },
    interiorSpawnPoint: { x: doorCol + 0.5, y: doorRow + 0.42, cell: doorRow * cols + doorCol },
    collisionAreas,
    overlayArea: { col, row, width, height: Math.max(0.55, height * 0.62) },
    depthOrigin: { x: col + width / 2, y: row + height }
  };
}
