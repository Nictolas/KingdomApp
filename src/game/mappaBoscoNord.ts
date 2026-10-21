import { getIndiciFootprint, isAcqua } from "./mappaGeometry";
import type { MappaRuntimeState } from "./mappaTypes";

/**
 * Bosco di raccolta nella fascia settentrionale della mappa, sopra l'abitato.
 * Per 50 righe la fascia preferita e' 4-11 (centro ideale 8), non la riga 20
 * usata dalla precedente correzione che lo lasciava accanto al Castello.
 */
export const BOSCO_ID = 51;
export const BOSCO_NORD_LATO = 5;

const cellaBosco = (id: number, anchor: number, indice: number) =>
  indice === anchor
    ? { id, nome: "Bosco", emoji: "🌲", footprint: { w: BOSCO_NORD_LATO, h: BOSCO_NORD_LATO } }
    : { id, nome: "Bosco", emoji: "", footprintRef: anchor };

export function trovaAnchorBoscoNord(
  state: MappaRuntimeState,
  cols: number,
  rows: number
): number | null {
  const lato = BOSCO_NORD_LATO;
  if (cols < lato + 4 || rows < lato + 5) return null;

  // Fascia nord REALE della mappa: per 50 righe cerca intorno alla riga 8.
  // Non scendere nell'abitato pur di trovare una zona libera.
  const targetRow = Math.floor(rows * 0.16);
  const centro = Math.floor((cols - lato) / 2);
  const minRow = Math.max(2, Math.floor(rows * 0.08));
  const maxRow = Math.min(rows - lato - 2, Math.ceil(rows * 0.22));
  const candidati: { indice: number; distanza: number }[] = [];

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = 2; c <= cols - lato - 2; c++) {
      const index = r * cols + c;
      candidati.push({
        indice: index,
        distanza: Math.abs(r - targetRow) * 5 + Math.abs(c - centro)
      });
    }
  }
  candidati.sort((a, b) => a.distanza - b.distanza || a.indice - b.indice);

  const libero = (index: number): boolean =>
    !isAcqua(index, cols, rows) &&
    state.edificiInMappa[index] == null &&
    state.decorazioniInMappa[index] == null &&
    !["river", "sand", "sabbia", "water", "mare"].includes(state.terrenoInMappa[index] ?? "erba");

  for (const { indice: anchor } of candidati) {
    if (!getIndiciFootprint(anchor, lato, lato, cols).every(libero)) continue;
    const entrata = anchor + lato * cols;
    let accessi = 0;
    for (let dc = 0; dc < lato; dc++) {
      if (libero(entrata + dc)) accessi++;
    }
    // Tutti gli ingressi devono essere liberi: il giocatore e i Raccoglitori
    // non devono comparire sopra edifici o strade occupate.
    if (accessi === lato) return anchor;
  }
  return null;
}

/** La correzione precedente ha creato un Bosco 5x5 nella zona centrale
 * (righe 13-24 per 50x50). Migra SOLO quel footprint completo, riconoscibile
 * da id/nome/riferimenti, verso la fascia nord. I boschi gia' a nord non
 * vengono spostati; quelli di altro tipo o posizione non vengono toccati.
 */
function boscoCentraleDaRiposizionare(
  state: MappaRuntimeState,
  cols: number,
  rows: number
): number | null {
  for (const [key, edificio] of Object.entries(state.edificiInMappa)) {
    const anchor = Number(key);
    if (
      edificio.nome !== "Bosco" || edificio.id !== BOSCO_ID ||
      edificio.footprintRef != null ||
      edificio.footprint?.w !== BOSCO_NORD_LATO ||
      edificio.footprint?.h !== BOSCO_NORD_LATO ||
      Math.floor(anchor / cols) < Math.floor(rows * 0.26) ||
      Math.floor(anchor / cols) > Math.ceil(rows * 0.50)
    ) continue;
    const celle = getIndiciFootprint(anchor, BOSCO_NORD_LATO, BOSCO_NORD_LATO, cols);
    if (celle.every(idx => {
      const attuale = state.edificiInMappa[idx];
      return attuale?.id === BOSCO_ID && attuale.nome === "Bosco" &&
        (idx === anchor ? attuale.footprintRef == null : attuale.footprintRef === anchor);
    })) return anchor;
  }
  return null;
}

export function ripristinaBoscoNord(
  state: MappaRuntimeState,
  cols: number,
  rows: number
): MappaRuntimeState {
  const containsBosco = Object.values(state.edificiInMappa).some(e => e.nome === "Bosco");
  if (containsBosco) {
    const previousAnchor = boscoCentraleDaRiposizionare(state, cols, rows);
    if (previousAnchor == null) return state;
    const oldCells = new Set(getIndiciFootprint(previousAnchor, BOSCO_NORD_LATO, BOSCO_NORD_LATO, cols));
    const filtered = Object.fromEntries(
      Object.entries(state.edificiInMappa).filter(([index]) => !oldCells.has(Number(index)))
    );
    const withoutOld = { ...state, edificiInMappa: filtered };
    const newAnchor = trovaAnchorBoscoNord(withoutOld, cols, rows);
    // Se la nuova zona e' occupata, conserva integralmente quella precedente.
    if (newAnchor == null) return state;
    return inserisciBoscoAt(withoutOld, newAnchor, cols);
  }
  const newAnchor = trovaAnchorBoscoNord(state, cols, rows);
  return newAnchor == null ? state : inserisciBoscoAt(state, newAnchor, cols);
}

function inserisciBoscoAt(state: MappaRuntimeState, anchor: number, cols: number): MappaRuntimeState {
  const edificiInMappa = { ...state.edificiInMappa };
  for (const index of getIndiciFootprint(anchor, BOSCO_NORD_LATO, BOSCO_NORD_LATO, cols)) {
    edificiInMappa[index] = cellaBosco(BOSCO_ID, anchor, index);
  }
  return { ...state, edificiInMappa };
}
