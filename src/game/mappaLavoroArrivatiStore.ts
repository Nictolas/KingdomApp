/** Sincronizza chi è “al lavoro” sulla mappa (dentro l’edificio) per le schermate edificio. */

let lavoroArrivatiSnapshot = new Set<number>();
const listeners = new Set<() => void>();

const EMPTY_LAVORO_ARRIVATI = new Set<number>();

export function setLavoroArrivatiMappaSnapshot(ids: ReadonlySet<number>): void {
  lavoroArrivatiSnapshot = new Set(ids);
  listeners.forEach((l) => l());
}

export function subscribeLavoroArrivatiMappa(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Riferimento stabile fino al prossimo aggiornamento (useSyncExternalStore). */
export function getLavoroArrivatiMappaSnapshot(): Set<number> {
  return lavoroArrivatiSnapshot.size > 0 ? lavoroArrivatiSnapshot : EMPTY_LAVORO_ARRIVATI;
}
