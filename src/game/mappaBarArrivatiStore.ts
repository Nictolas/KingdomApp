/** Sincronizza chi è “entrato” al Bar (stesso stato della mappa) per la schermata /bar. */

let barArrivatiSnapshot = new Set<number>();
const listeners = new Set<() => void>();

export function setBarArrivatiMappaSnapshot(ids: Set<number>): void {
  barArrivatiSnapshot = new Set(ids);
  listeners.forEach((l) => l());
}

export function subscribeBarArrivatiMappa(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getBarArrivatiMappaSnapshot(): Set<number> {
  return barArrivatiSnapshot;
}
