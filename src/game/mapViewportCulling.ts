/**
 * Massimo overscan in celle oltre il viewport.
 *
 * Il pan web viene applicato immediatamente tramite transform CSS, mentre React
 * aggiorna il sottoinsieme di celle renderizzate nel frame seguente. A zoom 0.5x
 * manteniamo quindi le 16 celle storiche: con celle da 40 px equivalgono a 320 px
 * sullo schermo, cioè il margine minimo già tollerato dal comportamento attuale.
 */
export const MAP_VIEWPORT_MARGIN_CELLS = 16;

/**
 * Margine desiderato espresso in larghezze-cella sullo schermo.
 * Con CELL_SIZE_PX=40 equivale ad almeno 320 px indipendentemente dallo zoom.
 */
export const MAP_VIEWPORT_TARGET_SCREEN_MARGIN_CELLS = 8;

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

/**
 * Converte il margine desiderato sullo schermo in celle del mondo.
 *
 * 0.5x -> 16 celle, 1x -> 8, 2x -> 4, 3x -> 3. In questo modo lo zoom alto
 * non trascina nel DOM centinaia di celle invisibili solo per conservare un
 * margine in coordinate mondo molto più grande del necessario.
 */
export function computeViewportMarginCells(
  scale: number,
  maxMarginCells = MAP_VIEWPORT_MARGIN_CELLS
): number {
  if (!Number.isFinite(scale) || scale <= 0) return maxMarginCells;
  return Math.min(
    maxMarginCells,
    Math.max(1, Math.ceil(MAP_VIEWPORT_TARGET_SCREEN_MARGIN_CELLS / scale))
  );
}

/** Area visibile del contenuto mappa in coordinate pixel (top-left del contenuto). */
export function computeVisibleCellRange(
  viewportW: number,
  viewportH: number,
  transform: MapTransformState,
  cols: number,
  rows: number,
  cellPx: number,
  marginCells?: number
): VisibleCellRange {
  if (viewportW <= 0 || viewportH <= 0) {
    return { colStart: 0, colEnd: cols, rowStart: 0, rowEnd: rows };
  }

  const { positionX, positionY, scale } = transform;
  const s = scale || 1;
  const effectiveMarginCells = marginCells ?? computeViewportMarginCells(s);
  const left = -positionX / s;
  const top = -positionY / s;
  const right = (viewportW - positionX) / s;
  const bottom = (viewportH - positionY) / s;

  return {
    colStart: Math.max(0, Math.floor(left / cellPx) - effectiveMarginCells),
    colEnd: Math.min(cols, Math.ceil(right / cellPx) + effectiveMarginCells),
    rowStart: Math.max(0, Math.floor(top / cellPx) - effectiveMarginCells),
    rowEnd: Math.min(rows, Math.ceil(bottom / cellPx) + effectiveMarginCells)
  };
}

export function visibleCellRangesEqual(a: VisibleCellRange, b: VisibleCellRange): boolean {
  return (
    a.colStart === b.colStart &&
    a.colEnd === b.colEnd &&
    a.rowStart === b.rowStart &&
    a.rowEnd === b.rowEnd
  );
}

/**
 * Il transform CSS viene aggiornato dalla libreria di pan/zoom indipendentemente da React.
 * React deve quindi ricevere un nuovo transform solo quando quel movimento cambia davvero
 * le celle incluse nel culling; in caso contrario sarebbe un render completo inutile.
 */
export function shouldCommitMapTransformForCulling(
  viewportW: number,
  viewportH: number,
  previous: MapTransformState,
  next: MapTransformState,
  cols: number,
  rows: number,
  cellPx: number,
  marginCells?: number
): boolean {
  if (viewportW <= 0 || viewportH <= 0) return true;

  const previousRange = computeVisibleCellRange(
    viewportW,
    viewportH,
    previous,
    cols,
    rows,
    cellPx,
    marginCells
  );
  const nextRange = computeVisibleCellRange(
    viewportW,
    viewportH,
    next,
    cols,
    rows,
    cellPx,
    marginCells
  );
  return !visibleCellRangesEqual(previousRange, nextRange);
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
