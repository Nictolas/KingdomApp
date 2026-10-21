import type { TerrenoType } from "./riverGeneration";
import type { EdificioInCellaMappa } from "./mappaTypes";
import {
  DISSALATORE_FOOTPRINT_H,
  DISSALATORE_FOOTPRINT_W
} from "./mappaLayoutConfig";
import { getIndiciFootprint, isAcqua } from "./mappaGeometry";
import { footprintIntersecaForestaNord } from "./mappaForestaConfine";

/** Sabbia = terreno sabbia su terraferma (non mare). */
export function cellaÈSabbiaDissalatore(
  index: number,
  terrenoInMappa: Record<number, TerrenoType>,
  cols: number,
  rows: number
): boolean {
  if (isAcqua(index, cols, rows)) return false;
  return (terrenoInMappa[index] ?? "erba") === "sabbia";
}

/**
 * Rettangolo 2×2 con esattamente 2 celle sul mare (bordo mappa) e 2 sulla sabbia; niente fiume né edifici.
 */
export function footprintDissalatoreMareSabbiaValido(
  anchor: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, EdificioInCellaMappa>
): boolean {
  const w = DISSALATORE_FOOTPRINT_W;
  const h = DISSALATORE_FOOTPRINT_H;
  const ac = anchor % cols;
  const ar = Math.floor(anchor / cols);
  if (ac + w > cols || ar + h > rows || footprintIntersecaForestaNord(anchor, w, h, cols, rows)) return false;
  const celle = getIndiciFootprint(anchor, w, h, cols);
  let nMare = 0;
  let nSabbia = 0;
  for (const i of celle) {
    if (edificiInMappa[i]) return false;
    const t = terrenoInMappa[i] ?? "erba";
    if (t === "river") return false;
    if (isAcqua(i, cols, rows)) nMare++;
    else if (cellaÈSabbiaDissalatore(i, terrenoInMappa, cols, rows)) nSabbia++;
    else return false;
  }
  return nMare === 2 && nSabbia === 2;
}

/** Cerca un ancoraggio 2×2 valido per il Dissalatore, partendo dalla cella toccata. */
export function trovaAnchorDissalatore(
  preferredCell: number,
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  terrenoInMappa: Record<number, TerrenoType>,
  cols: number,
  rows: number
): number | null {
  const w = DISSALATORE_FOOTPRINT_W;
  const h = DISSALATORE_FOOTPRINT_H;
  const pc = preferredCell % cols;
  const pr = Math.floor(preferredCell / cols);
  const dist = (an: number) => {
    const aac = an % cols;
    const aar = Math.floor(an / cols);
    return Math.abs(aac - pc) + Math.abs(aar - pr);
  };
  const candidati = new Set<number>();
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      const ac = pc - dc;
      const ar = pr - dr;
      if (ac < 0 || ar < 0) continue;
      if (ac + w > cols || ar + h > rows) continue;
      candidati.add(ar * cols + ac);
    }
  }
  const sortedNear = [...candidati].sort((a, b) => dist(a) - dist(b));
  for (const an of sortedNear) {
    if (footprintDissalatoreMareSabbiaValido(an, cols, rows, terrenoInMappa, edificiInMappa)) {
      return an;
    }
  }
  /** Solo ancore che includono la cella toccata: coerente con anteprima verde/rossa. */
  return null;
}
