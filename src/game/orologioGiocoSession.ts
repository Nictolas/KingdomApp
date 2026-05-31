/**
 * Orologio di gioco globale: 1 secondo reale = 30 minuti in-game.
 * Condiviso tra mappa, Bar e altre schermate che devono usare lo stesso tempo.
 */

/** Minuti di gioco aggiunti per ogni secondo trascorso nel mondo reale. */
export const MINUTI_GIOCO_PER_SECONDO_REALE = 30;

let orologioGiocoMinutiDaMezzanotte = 6 * 60;
let orologioGiocoLastRealMs: number | null = null;
let orologioGiocoInPausa = false;

const pausaListeners = new Set<() => void>();

function notifyPausaListeners(): void {
  pausaListeners.forEach((l) => l());
}

export function subscribeOrologioGiocoInPausa(listener: () => void): () => void {
  pausaListeners.add(listener);
  return () => pausaListeners.delete(listener);
}

export function getOrologioGiocoInPausaSnapshot(): boolean {
  return orologioGiocoInPausa;
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
  if (orologioGiocoInPausa) {
    orologioGiocoLastRealMs = Date.now();
    return orologioGiocoMinutiDaMezzanotte;
  }
  const elapsedSeconds = Math.floor((Date.now() - orologioGiocoLastRealMs) / 1000);
  const catchUp = elapsedSeconds * MINUTI_GIOCO_PER_SECONDO_REALE;
  orologioGiocoMinutiDaMezzanotte = (orologioGiocoMinutiDaMezzanotte + catchUp) % 1440;
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
