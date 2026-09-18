export type PhaserWorldView = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PhaserGridCellRange = {
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
};

/**
 * True se un punto mondo è dentro (o poco oltre) il viewport della camera.
 * Il padding evita pop-in di sprite/label ai bordi durante pan, zoom e tween.
 */
export function isPointNearPhaserWorldView(
  x: number,
  y: number,
  worldView: PhaserWorldView,
  padding = 0
): boolean {
  const safePadding = Math.max(0, padding);
  return (
    x >= worldView.x - safePadding &&
    x <= worldView.x + worldView.width + safePadding &&
    y >= worldView.y - safePadding &&
    y <= worldView.y + worldView.height + safePadding
  );
}

export function computePhaserWorldViewCellRange(
  worldView: PhaserWorldView,
  cols: number,
  rows: number,
  cellSize: number,
  paddingCells = 0
): PhaserGridCellRange {
  const safeCols = Math.max(1, cols);
  const safeRows = Math.max(1, rows);
  const safeCellSize = Math.max(1, cellSize);
  const padding = Math.max(0, paddingCells) * safeCellSize;

  const clampCol = (value: number) => Math.max(0, Math.min(safeCols - 1, value));
  const clampRow = (value: number) => Math.max(0, Math.min(safeRows - 1, value));

  return {
    colStart: clampCol(Math.floor((worldView.x - padding) / safeCellSize)),
    colEnd: clampCol(Math.floor((worldView.x + worldView.width + padding) / safeCellSize)),
    rowStart: clampRow(Math.floor((worldView.y - padding) / safeCellSize)),
    rowEnd: clampRow(Math.floor((worldView.y + worldView.height + padding) / safeCellSize))
  };
}

export function phaserGridCellRangeContains(
  outer: PhaserGridCellRange | null,
  inner: PhaserGridCellRange
): boolean {
  return (
    outer != null &&
    inner.colStart >= outer.colStart &&
    inner.colEnd <= outer.colEnd &&
    inner.rowStart >= outer.rowStart &&
    inner.rowEnd <= outer.rowEnd
  );
}

export function phaserGridCellRangesEqual(
  a: PhaserGridCellRange | null,
  b: PhaserGridCellRange
): boolean {
  return (
    a != null &&
    a.colStart === b.colStart &&
    a.colEnd === b.colEnd &&
    a.rowStart === b.rowStart &&
    a.rowEnd === b.rowEnd
  );
}

export function isCellInsidePhaserGridRange(
  cellIndex: number,
  cols: number,
  range: PhaserGridCellRange
): boolean {
  const col = cellIndex % cols;
  const row = Math.floor(cellIndex / cols);
  return (
    col >= range.colStart &&
    col <= range.colEnd &&
    row >= range.rowStart &&
    row <= range.rowEnd
  );
}

export type PhaserGridRangeDelta = {
  hiddenCells: number[];
  shownCells: number[];
};

function isGridCoordinateInsidePhaserRange(
  col: number,
  row: number,
  range: PhaserGridCellRange
): boolean {
  return (
    col >= range.colStart &&
    col <= range.colEnd &&
    row >= range.rowStart &&
    row <= range.rowEnd
  );
}

/**
 * Restituisce solo le celle che cambiano visibilità tra due range camera.
 * Evita di riesaminare l'intera mappa ad ogni attraversamento di cella.
 */
export function computePhaserGridRangeDelta(
  previous: PhaserGridCellRange,
  next: PhaserGridCellRange,
  cols: number
): PhaserGridRangeDelta {
  const safeCols = Math.max(1, cols);
  const hiddenCells: number[] = [];
  const shownCells: number[] = [];

  for (let row = previous.rowStart; row <= previous.rowEnd; row++) {
    for (let col = previous.colStart; col <= previous.colEnd; col++) {
      if (!isGridCoordinateInsidePhaserRange(col, row, next)) {
        hiddenCells.push(row * safeCols + col);
      }
    }
  }

  for (let row = next.rowStart; row <= next.rowEnd; row++) {
    for (let col = next.colStart; col <= next.colEnd; col++) {
      if (!isGridCoordinateInsidePhaserRange(col, row, previous)) {
        shownCells.push(row * safeCols + col);
      }
    }
  }

  return { hiddenCells, shownCells };
}
