export const MAP_VIEWPORT_MARGIN_CELLS = 2;

export type MapTransformState = {
  positionX: number;
  positionY: number;
  scale: number;
};

export type VisibleCellRange = {
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
};

/** Area visibile del contenuto mappa in coordinate pixel (top-left del contenuto). */
export function computeVisibleCellRange(
  viewportW: number,
  viewportH: number,
  transform: MapTransformState,
  cols: number,
  rows: number,
  cellPx: number,
  marginCells = MAP_VIEWPORT_MARGIN_CELLS
): VisibleCellRange {
  if (viewportW <= 0 || viewportH <= 0) {
    return { colStart: 0, colEnd: cols, rowStart: 0, rowEnd: rows };
  }

  const { positionX, positionY, scale } = transform;
  const s = scale || 1;
  const left = -positionX / s;
  const top = -positionY / s;
  const right = (viewportW - positionX) / s;
  const bottom = (viewportH - positionY) / s;

  return {
    colStart: Math.max(0, Math.floor(left / cellPx) - marginCells),
    colEnd: Math.min(cols, Math.ceil(right / cellPx) + marginCells),
    rowStart: Math.max(0, Math.floor(top / cellPx) - marginCells),
    rowEnd: Math.min(rows, Math.ceil(bottom / cellPx) + marginCells)
  };
}

export function buildVisibleCellIndices(range: VisibleCellRange, cols: number): number[] {
  const out: number[] = [];
  for (let r = range.rowStart; r < range.rowEnd; r++) {
    const rowBase = r * cols;
    for (let c = range.colStart; c < range.colEnd; c++) {
      out.push(rowBase + c);
    }
  }
  return out;
}

export function footprintIntersectsRange(
  anchor: number,
  footprint: { w: number; h: number },
  cols: number,
  range: VisibleCellRange
): boolean {
  const ac = anchor % cols;
  const ar = Math.floor(anchor / cols);
  return (
    ac + footprint.w > range.colStart &&
    ac < range.colEnd &&
    ar + footprint.h > range.rowStart &&
    ar < range.rowEnd
  );
}
