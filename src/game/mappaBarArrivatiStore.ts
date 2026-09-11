/** Sincronizza chi è “entrato” a ciascun Bar (stesso stato della mappa) per le schede Impresa `/impresa/[id]` e `/bar/[id]`. */

let barArrivatiSnapshot = new Map<number, Set<number>>();
const listeners = new Set<() => void>();

const EMPTY_BAR_ARRIVATI = new Set<number>();

export function setBarArrivatiMappaSnapshot(m: Map<number, Set<number>>): void {
  barArrivatiSnapshot = new Map([...m.entries()].map(([k, v]) => [k, new Set(v)]));
  listeners.forEach((l) => l());
}

export function subscribeBarArrivatiMappa(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Riferimento stabile fino al prossimo aggiornamento (richiesto da useSyncExternalStore).
 */
export function getBarArrivatiMappaSnapshotForEdificio(edificioId: number): Set<number> {
  return barArrivatiSnapshot.get(edificioId) ?? EMPTY_BAR_ARRIVATI;
}
