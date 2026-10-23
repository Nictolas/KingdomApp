/** Pure grid geometry helpers shared by the map runtime. */

import type { TerrenoType } from "./riverGeneration";
import { cellaNellaFasciaErbaSottoForesta, cellaNellaForestaNord, righeForestaNord } from "./mappaForestaConfine";

/** True for cells on the outer border of the map. */
export function isAcqua(index: number, cols: number, rows: number): boolean {
  const row = Math.floor(index / cols);
  const col = index % cols;
  if (cellaNellaForestaNord(index, cols, rows) || cellaNellaFasciaErbaSottoForesta(index, cols, rows)) return false;
  return (row === 0 && righeForestaNord(cols, rows) === 0) || row === rows - 1 || col === 0 || col === cols - 1;
}

/** Indices occupied by a w×h footprint anchored at its top-left cell. */
export function getIndiciFootprint(anchor: number, w: number, h: number, cols: number): number[] {
  const ac = anchor % cols;
  const ar = Math.floor(anchor / cols);
  const out: number[] = [];
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      out.push((ar + dr) * cols + (ac + dc));
    }
  }
  return out;
}

/** Eight neighboring cells (orthogonal + diagonal), clipped to map bounds. */
export function getVicini8(index: number, cols: number, rows: number): number[] {
  const c = index % cols;
  const r = Math.floor(index / cols);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r2 = r + dr;
      const c2 = c + dc;
      if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
      out.push(r2 * cols + c2);
    }
  }
  return out;
}

/** One-cell ring around a footprint, excluding the footprint itself. */
export function getIndiciCuscinoErba(
  anchor: number,
  w: number,
  h: number,
  cols: number,
  rows: number
): number[] {
  const ac = anchor % cols;
  const ar = Math.floor(anchor / cols);
  const foot = new Set(getIndiciFootprint(anchor, w, h, cols));
  const out: number[] = [];
  for (let dr = -1; dr <= h; dr++) {
    for (let dc = -1; dc <= w; dc++) {
      const inside = dr >= 0 && dr < h && dc >= 0 && dc < w;
      if (inside) continue;
      const r = ar + dr;
      const c = ac + dc;
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      const i = r * cols + c;
      if (!foot.has(i)) out.push(i);
    }
  }
  return out;
}


/** River cell indices derived from the terrain lookup. */
export function riverSetDaTerreno(terreno: Record<number, TerrenoType>): Set<number> {
  const out = new Set<number>();
  for (const [key, value] of Object.entries(terreno)) {
    if (value === "river") out.add(Number(key));
  }
  return out;
}

/** True when any of the eight neighboring cells is a river cell. */
export function haVicinoFiume(index: number, riverSet: Set<number>, cols: number, rows: number): boolean {
  return getVicini8(index, cols, rows).some((n) => riverSet.has(n));
}

/** Cell suitable for grass-only placement: not border water, not river, and not next to a river. */
export function cellaSoloErba(index: number, cols: number, rows: number, riverSet: Set<number>): boolean {
  if (isAcqua(index, cols, rows) || riverSet.has(index)) return false;
  if (haVicinoFiume(index, riverSet, cols, rows)) return false;
  return true;
}


/** Adjacent orthogonal segments between cells on the same row or column. */
export function expandAxisToUnitSteps(from: number, to: number, cols: number): [number, number][] {
  const c1 = from % cols;
  const r1 = Math.floor(from / cols);
  const c2 = to % cols;
  const r2 = Math.floor(to / cols);
  if (r1 !== r2 && c1 !== c2) return [];
  const out: [number, number][] = [];
  if (r1 === r2) {
    if (c1 === c2) return [];
    const step = c2 > c1 ? 1 : -1;
    for (let c = c1; c !== c2; c += step) {
      const i = r1 * cols + c;
      out.push([i, i + step]);
    }
  } else {
    const step = r2 > r1 ? cols : -cols;
    for (let i = from; i !== to; i += step) {
      out.push([i, i + step]);
    }
  }
  return out;
}

/** L-shaped Manhattan path represented only by adjacent orthogonal cell pairs. */
export function getManhattanPathSegments(from: number, to: number, cols: number): [number, number][] {
  const c1 = from % cols;
  const r1 = Math.floor(from / cols);
  const c2 = to % cols;
  const r2 = Math.floor(to / cols);
  if (c1 === c2 && r1 === r2) return [];
  if (c1 === c2) return expandAxisToUnitSteps(from, to, cols);
  if (r1 === r2) return expandAxisToUnitSteps(from, to, cols);
  const mid = r1 * cols + c2;
  return [...expandAxisToUnitSteps(from, mid, cols), ...expandAxisToUnitSteps(mid, to, cols)];
}


/** Angolo in alto a sinistra di una cella in px, includendo il gap fra celle. */
export function getCellTopLeft(
  cellIndex: number,
  cellW: number,
  cellH: number,
  cols: number,
  gap: number
): { left: number; top: number } {
  const col = cellIndex % cols;
  const row = Math.floor(cellIndex / cols);
  return { left: col * (cellW + gap), top: row * (cellH + gap) };
}
