/** Calendario del gioco basato sull'orologio continuo. */
export const GIORNI_PER_MESE_GIOCO = 30;
export const MESI_PER_ANNO_GIOCO = 12;

export function indiceCalendarioGioco(mese: number, anno: number): number {
  const m = Math.max(1, Math.min(MESI_PER_ANNO_GIOCO, Math.trunc(mese)));
  const a = Math.max(0, Math.trunc(anno));
  return a * MESI_PER_ANNO_GIOCO + (m - 1);
}

/**
 * Indice mese derivato dal giorno globale dell'orologio.
 * Giorni 1-30 => mese indice 0, 31-60 => 1, ecc.
 * offsetMesi mantiene compatibili salvataggi creati quando mese/anno erano avanzati manualmente.
 */
export function indiceMeseDaGiornoGioco(giorno: number, offsetMesi = 0): number {
  const g = Math.max(1, Math.trunc(giorno));
  return Math.floor((g - 1) / GIORNI_PER_MESE_GIOCO) + Math.trunc(offsetMesi);
}

export function offsetMesiPerCalendarioSalvato(
  giorno: number,
  mese: number,
  anno: number
): number {
  return indiceCalendarioGioco(mese, anno) - indiceMeseDaGiornoGioco(giorno);
}
