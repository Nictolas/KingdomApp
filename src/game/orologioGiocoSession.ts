/**
 * Orologio di gioco globale: 1 secondo reale = 30 minuti in-game.
 * Condiviso tra mappa, Bar e altre schermate che devono usare lo stesso tempo.
 */

/** Minuti di gioco aggiunti per ogni secondo trascorso nel mondo reale. */
export const MINUTI_GIOCO_PER_SECONDO_REALE = 30;

let orologioGiocoMinutiDaMezzanotte = 6 * 60;
let orologioGiocoLastRealMs: number | null = null;
let orologioGiocoInPausa = false;
// Parte bloccato: la creazione del Comandante non deve far avanzare il mondo.
let orologioGiocoBloccatoDallaFase = true;
/** Giorno di gioco (1 = primo giorno); avanza a ogni mezzanotte dell'orologio. */
let orologioGiocoGiorno = 1;

const pausaListeners = new Set<() => void>();
const giornoListeners = new Set<() => void>();

function notifyGiornoListeners(): void {
  giornoListeners.forEach((l) => l());
}

export function subscribeGiornoGioco(listener: () => void): () => void {
  giornoListeners.add(listener);
  return () => giornoListeners.delete(listener);
}

export function getGiornoGiocoSnapshot(): number {
  return orologioGiocoGiorno;
}

function notifyPausaListeners(): void {
  pausaListeners.forEach((l) => l());
}

export function subscribeOrologioGiocoInPausa(listener: () => void): () => void {
  pausaListeners.add(listener);
  return () => pausaListeners.delete(listener);
}

export function getOrologioGiocoInPausaSnapshot(): boolean {
  return orologioGiocoInPausa || orologioGiocoBloccatoDallaFase;
}

export function setOrologioGiocoBloccatoDallaFase(bloccato: boolean): void {
  if (orologioGiocoBloccatoDallaFase === bloccato) return;
  orologioGiocoBloccatoDallaFase = bloccato;
  // Il tempo reale trascorso durante il blocco non deve essere recuperato alla ripresa.
  orologioGiocoLastRealMs = Date.now();
  notifyPausaListeners();
}

export function setOrologioGiocoInPausa(pausa: boolean): void {
  if (orologioGiocoInPausa === pausa) return;
  orologioGiocoInPausa = pausa;
  if (orologioGiocoLastRealMs != null) {
    orologioGiocoLastRealMs = Date.now();
  }
  notifyPausaListeners();
}

export function toggleOrologioGiocoPausa(): void {
  setOrologioGiocoInPausa(!orologioGiocoInPausa);
}

/** Aggiorna il tempo in base al clock reale e restituisce i minuti da mezzanotte [0, 1440). */
export function syncOrologioGiocoDaWallClock(): number {
  if (orologioGiocoLastRealMs == null) {
    orologioGiocoLastRealMs = Date.now();
    return orologioGiocoMinutiDaMezzanotte;
  }
  if (getOrologioGiocoInPausaSnapshot()) {
    orologioGiocoLastRealMs = Date.now();
    return orologioGiocoMinutiDaMezzanotte;
  }
  const minutiPrima = orologioGiocoMinutiDaMezzanotte;
  const elapsedSeconds = Math.floor((Date.now() - orologioGiocoLastRealMs) / 1000);
  const catchUp = elapsedSeconds * MINUTI_GIOCO_PER_SECONDO_REALE;
  const minutiTotali = minutiPrima + catchUp;
  orologioGiocoMinutiDaMezzanotte = minutiTotali % 1440;
  const giorniPassati = Math.floor(minutiTotali / 1440);
  if (giorniPassati > 0) {
    orologioGiocoGiorno += giorniPassati;
    notifyGiornoListeners();
  }
  orologioGiocoLastRealMs = Date.now();
  return orologioGiocoMinutiDaMezzanotte;
}

export function getOrologioMinutiSnapshot(): number {
  return orologioGiocoMinutiDaMezzanotte;
}

export function formatOrologioGioco(minutiDaMezzanotte: number): string {
  const m = ((minutiDaMezzanotte % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
