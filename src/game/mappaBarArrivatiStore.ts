/** Sincronizza chi è “entrato” a ciascun Bar (stesso stato della mappa) per le schermate `/bar/[id]`. */

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


/** Rimuove un abitante da tutti i Bar e scarta le liste rimaste vuote. */
export function rimuoviAbitanteDaTuttiBar(
  prev: Record<number, number[]>,
  abitanteId: number
): Record<number, number[]> {
  const next: Record<number, number[]> = {};
  for (const [k, ids] of Object.entries(prev)) {
    const filt = ids.filter((id) => id !== abitanteId);
    if (filt.length > 0) next[Number(k)] = filt;
  }
  return next;
}

/** Sposta un abitante nel Bar indicato, garantendo che compaia in un solo Bar. */
export function aggiungiAbitanteAlBarEdificio(
  prev: Record<number, number[]>,
  barEdificioId: number,
  abitanteId: number
): Record<number, number[]> {
  const cleaned = rimuoviAbitanteDaTuttiBar(prev, abitanteId);
  const cur = cleaned[barEdificioId] ?? [];
  if (cur.includes(abitanteId)) return cleaned;
  return { ...cleaned, [barEdificioId]: [...cur, abitanteId] };
}
