import { getIndiciFootprint, isAcqua } from "./mappaGeometry";
import type { MappaRuntimeState } from "./mappaTypes";

/**
 * Ripristina l'area naturale di raccolta al nord del regno.
 * Il Bosco era gia' registrato nel catalogo (ID 51), ma la sua posizione era
 * sparita dal generatore della mappa.
 *
 * Non sposta mai edifici o strade e non modifica le risorse nei salvataggi:
 * cerca un rettangolo libero di 5x5, prima a nord e vicino al centro.
 */
export const BOSCO_ID = 51;
export const BOSCO_NORD_LATO = 5;

export function trovaAnchorBoscoNord(
  state: MappaRuntimeState,
  cols: number,
  rows: number
): number | null {
  if (cols < BOSCO_NORD_LATO + 4 || rows < BOSCO_NORD_LATO + 5) return null;

  const lato = BOSCO_NORD_LATO;
  const centro = Math.floor((cols - lato) / 2);
  const maxRiga = Math.min(14, rows - lato - 2);
  const candidati: { indice: number; distanza: number }[] = [];
  for (let r = 2; r <= maxRiga; r++) {
    for (let c = 2; c <= cols - lato - 2; c++) {
      const anchor = r * cols + c;
      // Il baricentro del bosco resta in alto. In caso di ostacoli si sposta
      // lateralmente prima di scendere verso la parte abitata.
      candidati.push({
        indice: anchor,
        distanza: (r - 2) * 4 + Math.abs(c - centro)
      });
    }
  }
  candidati.sort((a, b) => a.distanza - b.distanza || a.indice - b.indice);

  const libero = (index: number): boolean =>
    !isAcqua(index, cols, rows) &&
    state.edificiInMappa[index] == null &&
    state.decorazioniInMappa[index] == null &&
    !["river", "sand", "water", "mare"].includes(state.terrenoInMappa[index] ?? "erba");

  for (const { indice: anchor } of candidati) {
    const celle = getIndiciFootprint(anchor, lato, lato, cols);
    if (!celle.every(libero)) continue;
    // Gli ingressi del Bosco sono lungo il bordo sud esterno: lascia uno
    // spazio di arrivo percorribile anche nelle vecchie mappe.
    const south = anchor + lato * cols;
    let ingressiLiberi = 0;
    for (let dc = 0; dc < lato; dc++) {
      if (libero(south + dc)) ingressiLiberi++;
    }
    if (ingressiLiberi < 2) continue;
    return anchor;
  }
  return null;
}

export function ripristinaBoscoNord(
  state: MappaRuntimeState,
  cols: number,
  rows: number
): MappaRuntimeState {
  // Idempotente: conserva la posizione originale e l'identita' dello stato
  // per non rigenerare il Bosco a ogni render o caricamento.
  if (Object.values(state.edificiInMappa).some(e => e.nome === "Bosco")) return state;
  const anchor = trovaAnchorBoscoNord(state, cols, rows);
  if (anchor == null) return state;

  const edificiInMappa = { ...state.edificiInMappa };
  const celle = getIndiciFootprint(anchor, BOSCO_NORD_LATO, BOSCO_NORD_LATO, cols);
  for (const indice of celle) {
    edificiInMappa[indice] = indice === anchor
      ? { id: BOSCO_ID, nome: "Bosco", emoji: "🌲", footprint: { w: BOSCO_NORD_LATO, h: BOSCO_NORD_LATO } }
      : { id: BOSCO_ID, nome: "Bosco", emoji: "", footprintRef: anchor };
  }
  return { ...state, edificiInMappa };
}
