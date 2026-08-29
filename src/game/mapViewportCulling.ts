/**
 * Celle prerenderizzate oltre il viewport.
 *
 * Il pan web viene applicato immediatamente tramite transform CSS, mentre React
 * aggiorna il sottoinsieme di celle renderizzate nel frame seguente. Un margine
 * troppo piccolo lascia quindi intravedere il fondo nero durante i drag rapidi.
 * 16 celle corrispondono a 640 px con le celle attuali da 40 px: abbastanza per
 * assorbire anche un gesto molto veloce senza rinunciare al culling della 50x50.
 */
export const MAP_VIEWPORT_MARGIN_CELLS = 16;

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
