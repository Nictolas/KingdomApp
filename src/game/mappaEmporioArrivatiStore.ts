/** Sincronizza chi è entrato in ciascun Emporio (visitatori) per la scheda Impresa. */

let emporioArrivatiSnapshot = new Map<number, Set<number>>();
const listeners = new Set<() => void>();

const EMPTY_EMPORIO_ARRIVATI = new Set<number>();

export function setEmporioArrivatiMappaSnapshot(m: Map<number, Set<number>>): void {
  emporioArrivatiSnapshot = new Map([...m.entries()].map(([k, v]) => [k, new Set(v)]));
  listeners.forEach((l) => l());
}

export function subscribeEmporioArrivatiMappa(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Riferimento stabile fino al prossimo aggiornamento (useSyncExternalStore). */
export function getEmporioArrivatiMappaSnapshotForEdificio(edificioId: number): Set<number> {
  return emporioArrivatiSnapshot.get(edificioId) ?? EMPTY_EMPORIO_ARRIVATI;
}
