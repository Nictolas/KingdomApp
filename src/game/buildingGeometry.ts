export type CellRect = { col: number; row: number; width: number; height: number };
export type CellPoint = { x: number; y: number; cell: number };

export type BuildingGeometry = {
  footprint: CellRect;
  doorway: CellRect;
  doorCell: number;
  entryPoint: CellPoint;
  /** Se presente: ingresso da più lati (es. Bosco). Altrimenti vale solo `entryPoint`. */
  entryPoints?: readonly CellPoint[];
  interiorSpawnPoint: CellPoint;
  collisionAreas: readonly CellRect[];
  overlayArea: CellRect;
  depthOrigin: { x: number; y: number };
};

export const NOME_BOSCO = "Bosco";

export function edificioHaIngressoPerimetrale(nome: string): boolean {
  return nome === NOME_BOSCO;
}

export function cellInFootprint(cell: number, footprint: CellRect, cols: number): boolean {
  const col = cell % cols;
  const row = Math.floor(cell / cols);
  return (
    col >= footprint.col &&
    col < footprint.col + footprint.width &&
    row >= footprint.row &&
    row < footprint.row + footprint.height
  );
}

/** Cella interna al footprint o sulla porta (destinazione animazione ingresso). */
export function isBuildingInteriorCell(cell: number, geometry: BuildingGeometry, cols: number): boolean {
  if (cell === geometry.doorCell || cell === geometry.interiorSpawnPoint.cell) return true;
  return cellInFootprint(cell, geometry.footprint, cols);
}

export function findBuildingForInteriorCell<T extends { geometry: BuildingGeometry }>(
  cell: number,
  buildings: readonly T[],
  cols: number
): T | undefined {
  return buildings.find((building) => isBuildingInteriorCell(cell, building.geometry, cols));
}

export function isGeometryEntryCell(geometry: BuildingGeometry, cell: number): boolean {
  if (geometry.entryPoints && geometry.entryPoints.length > 0) {
    return geometry.entryPoints.some((p) => p.cell === cell);
  }
  return geometry.entryPoint.cell === cell;
}

/**
 * Celle esterne ortogonali al perimetro del footprint (N/E/S/O).
 * Usate come ingressi multipli (edifici aperti).
 */
export function celleEsternePerimetroFootprint(
  anchor: number,
  widthCells: number,
  heightCells: number,
  cols: number,
  rows: number
): number[] {
  const col = anchor % cols;
  const row = Math.floor(anchor / cols);
  const width = Math.max(1, Math.min(widthCells, cols - col));
  const height = Math.max(1, Math.min(heightCells, rows - row));
  const out = new Set<number>();

  for (let dc = 0; dc < width; dc++) {
    const c = col + dc;
    if (row > 0) out.add((row - 1) * cols + c);
    if (row + height < rows) out.add((row + height) * cols + c);
  }
  for (let dr = 0; dr < height; dr++) {
    const r = row + dr;
    if (col > 0) out.add(r * cols + (col - 1));
    if (col + width < cols) out.add(r * cols + (col + width));
  }
  return [...out];
}

/**
 * Solo il bordo sud esterno del footprint (ingresso “da sotto”, es. Bosco a striscia nord).
 */
export function celleIngressoSudFootprint(
  anchor: number,
  widthCells: number,
  heightCells: number,
  cols: number,
  rows: number
): number[] {
  const col = anchor % cols;
  const row = Math.floor(anchor / cols);
  const width = Math.max(1, Math.min(widthCells, cols - col));
  const height = Math.max(1, Math.min(heightCells, rows - row));
  const southRow = row + height;
  if (southRow >= rows) return [];
  const out: number[] = [];
  for (let dc = 0; dc < width; dc++) {
    out.push(southRow * cols + (col + dc));
  }
  return out;
}

/** Geometria runtime derivata dal footprint: non modifica il formato dei salvataggi. */
export function deriveBuildingGeometry(
  anchor: number,
  widthCells: number,
  heightCells: number,
  cols: number,
  rows: number,
  options?: { ingressoPerimetrale?: boolean; ingressoSoloSud?: boolean }
): BuildingGeometry {
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
  if (col + width - rightStart > 0.01) {
    collisionAreas.push({ col: rightStart, row: doorRow, width: col + width - rightStart, height: 1 });
  }

  const entryPointDefault: CellPoint = {
    x: doorCol + 0.5,
    y: exteriorRow + 0.5,
    cell: exteriorRow * cols + doorCol
  };

  let entryPoints: CellPoint[] | undefined;
  let entryPoint = entryPointDefault;
  let doorCell = doorRow * cols + doorCol;
  let interiorSpawnPoint: CellPoint = {
    x: doorCol + 0.5,
    y: doorRow + 0.42,
    cell: doorCell
  };

  if (options?.ingressoPerimetrale) {
    // Bosco: ingressi su tutto il bordo sud (fuori dal footprint), niente spawn al centro della striscia.
    const celle =
      options.ingressoSoloSud === false
        ? celleEsternePerimetroFootprint(anchor, width, height, cols, rows)
        : celleIngressoSudFootprint(anchor, width, height, cols, rows);
    entryPoints = celle.map((cell) => ({
      x: (cell % cols) + 0.5,
      y: Math.floor(cell / cols) + 0.5,
      cell
    }));
    const mid = celle[Math.floor(celle.length / 2)];
    if (mid != null) {
      entryPoint = {
        x: (mid % cols) + 0.5,
        y: Math.floor(mid / cols) + 0.5,
        cell: mid
      };
      doorCell = mid;
      interiorSpawnPoint = { ...entryPoint };
    }
  }

  return {
    footprint: { col, row, width, height },
    doorway: { col: doorLeft, row: doorRow, width: doorWidth, height: 1 },
    doorCell,
    entryPoint,
    entryPoints,
    interiorSpawnPoint,
    collisionAreas: options?.ingressoPerimetrale ? [{ col, row, width, height }] : collisionAreas,
    overlayArea: { col, row, width, height: Math.max(0.55, height * 0.62) },
    depthOrigin: { x: col + width / 2, y: row + height }
  };
}
