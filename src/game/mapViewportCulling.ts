/**
 * Margine massimo prerenderizzato nella direzione del movimento.
 *
 * Il pan web viene applicato immediatamente tramite transform CSS, mentre React
 * aggiorna il sottoinsieme di celle renderizzate nel frame seguente. Manteniamo
 * quindi fino a 16 celle (640 px con celle da 40 px) davanti al movimento rapido,
 * ma non abbiamo più bisogno di pagare lo stesso margine su tutti i lati.
 */
export const MAP_VIEWPORT_MARGIN_CELLS = 16;
/** Margine normale sui lati non interessati dal movimento corrente. */
export const MAP_VIEWPORT_BASE_MARGIN_CELLS = 8;

export type VisibleCellMargins = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type MapTransformState = {
  positionX: number;
  positionY: number;
  scale: number;
  /** Margini adattivi usati solo dal culling React; il transform CSS resta invariato. */
  cullingMargins?: VisibleCellMargins;
};

export type VisibleCellRange = {
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
};

function marginiSimmetrici(cells: number): VisibleCellMargins {
  return { left: cells, right: cells, top: cells, bottom: cells };
}

function normalizzaMargini(
  transform: MapTransformState,
  marginCells?: number | VisibleCellMargins
): VisibleCellMargins {
  if (typeof marginCells === "number") return marginiSimmetrici(marginCells);
  return marginCells ?? transform.cullingMargins ?? marginiSimmetrici(MAP_VIEWPORT_MARGIN_CELLS);
}

/**
 * Riduce l'overscan sui lati opposti al pan, mantenendo il margine storico da
 * 16 celle davanti al movimento. In caso di zoom resta prudenzialmente
 * simmetrico; se il gesto inverte direzione, conserva per un aggiornamento il
 * margine massimo su entrambi i lati dell'asse interessato.
 */
export function computeDirectionalCullingMargins(
  previous: MapTransformState,
  next: MapTransformState,
  baseMargin = MAP_VIEWPORT_BASE_MARGIN_CELLS,
  forwardMargin = MAP_VIEWPORT_MARGIN_CELLS
): VisibleCellMargins {
  const previousMargins = previous.cullingMargins ?? marginiSimmetrici(forwardMargin);
  if (Math.abs(next.scale - previous.scale) > 0.0001) {
    return marginiSimmetrici(forwardMargin);
  }

  const deltaContentX = previous.positionX - next.positionX;
  const deltaContentY = previous.positionY - next.positionY;
  let left = baseMargin;
  let right = baseMargin;
  let top = baseMargin;
  let bottom = baseMargin;

  if (deltaContentX > 0.01) {
    const inversione = previousMargins.left >= forwardMargin && previousMargins.right < forwardMargin;
    left = inversione ? forwardMargin : baseMargin;
    right = forwardMargin;
  } else if (deltaContentX < -0.01) {
    const inversione = previousMargins.right >= forwardMargin && previousMargins.left < forwardMargin;
    left = forwardMargin;
    right = inversione ? forwardMargin : baseMargin;
  }

  if (deltaContentY > 0.01) {
    const inversione = previousMargins.top >= forwardMargin && previousMargins.bottom < forwardMargin;
    top = inversione ? forwardMargin : baseMargin;
    bottom = forwardMargin;
  } else if (deltaContentY < -0.01) {
    const inversione = previousMargins.bottom >= forwardMargin && previousMargins.top < forwardMargin;
    top = forwardMargin;
    bottom = inversione ? forwardMargin : baseMargin;
  }

  return { left, right, top, bottom };
}

/** Area visibile del contenuto mappa in coordinate pixel (top-left del contenuto). */
export function computeVisibleCellRange(
  viewportW: number,
  viewportH: number,
  transform: MapTransformState,
  cols: number,
  rows: number,
  cellPx: number,
  marginCells?: number | VisibleCellMargins
): VisibleCellRange {
  if (viewportW <= 0 || viewportH <= 0) {
    return { colStart: 0, colEnd: cols, rowStart: 0, rowEnd: rows };
  }

  const { positionX, positionY, scale } = transform;
  const margins = normalizzaMargini(transform, marginCells);
  const s = scale || 1;
  const left = -positionX / s;
  const top = -positionY / s;
  const right = (viewportW - positionX) / s;
  const bottom = (viewportH - positionY) / s;

  return {
    colStart: Math.max(0, Math.floor(left / cellPx) - margins.left),
    colEnd: Math.min(cols, Math.ceil(right / cellPx) + margins.right),
    rowStart: Math.max(0, Math.floor(top / cellPx) - margins.top),
    rowEnd: Math.min(rows, Math.ceil(bottom / cellPx) + margins.bottom)
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
  marginCells?: number | VisibleCellMargins
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
