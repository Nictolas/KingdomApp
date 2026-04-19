/**
 * Orologio di gioco globale: 1 secondo reale = 1 minuto in-game.
 * Condiviso tra mappa, Bar e altre schermate che devono usare lo stesso tempo.
 */

let orologioGiocoMinutiDaMezzanotte = 6 * 60;
let orologioGiocoLastRealMs: number | null = null;

/** Aggiorna il tempo in base al clock reale e restituisce i minuti da mezzanotte [0, 1440). */
export function syncOrologioGiocoDaWallClock(): number {
  if (orologioGiocoLastRealMs == null) {
    orologioGiocoLastRealMs = Date.now();
    return orologioGiocoMinutiDaMezzanotte;
  }
  const catchUp = Math.floor((Date.now() - orologioGiocoLastRealMs) / 1000);
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
