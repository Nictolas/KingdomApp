/** Sincronizza chi è entrato in ciascun Luogo di Culto / Chiesa per le schede edificio. */

let cultoArrivatiSnapshot = new Map<number, Set<number>>();
const listeners = new Set<() => void>();

const EMPTY_CULTO_ARRIVATI = new Set<number>();

export function setCultoArrivatiMappaSnapshot(m: Map<number, Set<number>>): void {
  cultoArrivatiSnapshot = new Map([...m.entries()].map(([k, v]) => [k, new Set(v)]));
  listeners.forEach((l) => l());
}

export function subscribeCultoArrivatiMappa(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Riferimento stabile fino al prossimo aggiornamento (useSyncExternalStore). */
export function getCultoArrivatiMappaSnapshotForEdificio(edificioId: number): Set<number> {
  return cultoArrivatiSnapshot.get(edificioId) ?? EMPTY_CULTO_ARRIVATI;
}
