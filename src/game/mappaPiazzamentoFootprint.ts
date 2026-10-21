import {
  ADMIN_FOOTPRINT_H,
  ADMIN_FOOTPRINT_W,
  getIndiciEdificiIniziali
} from "./mappaLayoutConfig";
import {
  cellaSoloErba,
  getIndiciCuscinoErba,
  getIndiciFootprint,
  isAcqua
} from "./mappaGeometry";
import type { EdificioInCellaMappa } from "./mappaTypes";
import { footprintIntersecaForestaNord } from "./mappaForestaConfine";

/** Verifica che footprint e cuscino siano liberi da celle vietate, acqua e fiume. */
export function puòPiazzareFootprintConCuscino(
  anchor: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>
): boolean {
  const ac = anchor % cols;
  const ar = Math.floor(anchor / cols);
  if (ac + w > cols || ar + h > rows || footprintIntersecaForestaNord(anchor, w, h, cols, rows)) return false;
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      const i = (ar + dr) * cols + (ac + dc);
      if (vietato.has(i) || isAcqua(i, cols, rows) || riverSet.has(i)) return false;
    }
  }
  for (const i of getIndiciCuscinoErba(anchor, w, h, cols, rows)) {
    if (vietato.has(i) || !cellaSoloErba(i, cols, rows, riverSet)) return false;
  }
  return true;
}

/** Primo angolo w×h valido, ordinato per distanza Manhattan da `preferred`. */
export function trovaAnchorFootprintLibero(
  w: number,
  h: number,
  preferred: number,
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>
): number | null {
  const pc = preferred % cols;
  const pr = Math.floor(preferred / cols);
  const candidati = Array.from({ length: cols * rows }, (_, i) => i).sort((a, b) => {
    const ar = Math.floor(a / cols);
    const ac = a % cols;
    const br = Math.floor(b / cols);
    const bc = b % cols;
    return Math.abs(ar - pr) + Math.abs(ac - pc) - (Math.abs(br - pr) + Math.abs(bc - pc));
  });
  for (const anchor of candidati) {
    if (puòPiazzareFootprintConCuscino(anchor, w, h, cols, rows, riverSet, vietato)) return anchor;
  }
  return null;
}

/** Variante 1×1 della ricerca con cuscino. */
export function trovaCellaSingolaConCuscino(
  preferred: number,
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>
): number | null {
  return trovaAnchorFootprintLibero(1, 1, preferred, cols, rows, riverSet, vietato);
}

/**
 * Sceglie deterministicamente l'anchor 3×2 del Complesso amministrativo più vicino
 * alla posizione preferita del Castello, mantenendo il cuscino libero.
 */
export function scegliAnchorComplessoAmministrativo(
  cols: number,
  rows: number,
  riverSet: Set<number> = new Set<number>()
): number {
  const idx = getIndiciEdificiIniziali(cols, rows);
  const preferred = idx.CASTELLO_INDEX;
  const pc = preferred % cols;
  const pr = Math.floor(preferred / cols);
  const w = ADMIN_FOOTPRINT_W;
  const h = ADMIN_FOOTPRINT_H;
  const minR = 1;
  const maxR = rows - 2 - h;
  const minC = 1;
  const maxC = cols - 2 - w;
  let bestAnchor = preferred;
  let bestD = Infinity;
  const vietatoVuoto = new Set<number>();
  for (let ar = minR; ar <= maxR; ar++) {
    for (let ac = minC; ac <= maxC; ac++) {
      const anchor = ar * cols + ac;
      if (!puòPiazzareFootprintConCuscino(anchor, w, h, cols, rows, riverSet, vietatoVuoto)) continue;
      const d = Math.abs(ar - pr) + Math.abs(ac - pc);
      if (d < bestD) {
        bestD = d;
        bestAnchor = anchor;
      }
    }
  }
  return bestAnchor;
}

/** Aggiunge a `vietato` il footprint e il cuscino di una cella che lo circonda. */
export function estendiVietatoConFootprintECuscino(
  anchor: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  vietato: Set<number>
): void {
  for (const i of getIndiciFootprint(anchor, w, h, cols)) vietato.add(i);
  for (const i of getIndiciCuscinoErba(anchor, w, h, cols, rows)) vietato.add(i);
}

/** Footprint ∪ cuscino degli edifici iniziali ancorati; le celle secondarie non aggiungono riserve. */
export function vietatoFootprintECuscinoDaEdificiIniziali(
  edifici: Record<number, EdificioInCellaMappa>,
  cols: number,
  rows: number
): Set<number> {
  const vietato = new Set<number>();
  for (const idxStr of Object.keys(edifici)) {
    const idx = Number(idxStr);
    const e = edifici[idx];
    if (e.footprintRef != null) continue;
    if (e.footprint) {
      estendiVietatoConFootprintECuscino(idx, e.footprint.w, e.footprint.h, cols, rows, vietato);
    } else {
      estendiVietatoConFootprintECuscino(idx, 1, 1, cols, rows, vietato);
    }
  }
  return vietato;
}

/**
 * Solo in modalità Costruisci: il footprint deve poggiare su terra ma può
 * toccare una cella di mare/fiume. Conserva il divieto di sovrapporre edifici
 * e i cuscini intorno alle costruzioni esistenti.
 *
 * NON usare durante la generazione iniziale, che richiede la fascia asciutta.
 */
export function puòPiazzareFootprintManualeVicinoAcqua(
  anchor: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>
): boolean {
  if (!Number.isInteger(anchor) || anchor < 0 || !Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) return false;
  const ac = anchor % cols;
  const ar = Math.floor(anchor / cols);
  if (ac + w > cols || ar + h > rows || footprintIntersecaForestaNord(anchor, w, h, cols, rows)) return false;
  for (const i of getIndiciFootprint(anchor, w, h, cols)) {
    if (vietato.has(i) || isAcqua(i, cols, rows) || riverSet.has(i)) return false;
  }
  // Il cuscino attorno all'edificio può essere acqua, ma non un'altra costruzione.
  for (const i of getIndiciCuscinoErba(anchor, w, h, cols, rows)) {
    if (vietato.has(i)) return false;
  }
  return true;
}

/** Ricerca solo per costruzioni volontarie, senza forzare distanza dall'acqua. */
export function trovaAnchorFootprintManualeVicinoAcqua(
  w: number, h: number, preferred: number, cols: number, rows: number,
  riverSet: Set<number>, vietato: Set<number>
): number | null {
  const pc = preferred % cols;
  const pr = Math.floor(preferred / cols);
  const candidati = Array.from({ length: cols * rows }, (_, i) => i).sort((a, b) =>
    (Math.abs(Math.floor(a / cols) - pr) + Math.abs(a % cols - pc)) -
    (Math.abs(Math.floor(b / cols) - pr) + Math.abs(b % cols - pc))
  );
  for (const anchor of candidati) {
    if (puòPiazzareFootprintManualeVicinoAcqua(anchor, w, h, cols, rows, riverSet, vietato)) return anchor;
  }
  return null;
}
