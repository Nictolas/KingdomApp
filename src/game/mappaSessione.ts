import type { MappaRuntimeState } from "./mappaTypes";

let mappaSessione: MappaRuntimeState | null = null;
const listeners = new Set<() => void>();

export function getMappaSessione(): MappaRuntimeState | null {
  return mappaSessione;
}

export function setMappaSessione(state: MappaRuntimeState | null): void {
  if (mappaSessione === state) return;
  mappaSessione = state;
  listeners.forEach((listener) => listener());
}

export function subscribeMappaSessione(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
