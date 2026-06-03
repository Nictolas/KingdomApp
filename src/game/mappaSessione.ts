import type { MappaRuntimeState } from "./mappaTypes";

let mappaSessione: MappaRuntimeState | null = null;

export function getMappaSessione(): MappaRuntimeState | null {
  return mappaSessione;
}

export function setMappaSessione(state: MappaRuntimeState | null): void {
  mappaSessione = state;
}
