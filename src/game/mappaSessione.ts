import { MAP_COLS, MAP_ROWS } from "./mappaDimensioni";
import { migraMappaBoscoDueRettangoliEFiume } from "./boscoMappa";
import { migraMappaCostaSud, setActiveCostaSud } from "./mareCosta";
import type { MappaRuntimeState } from "./mappaTypes";

let mappaSessione: MappaRuntimeState | null = null;
const listeners = new Set<() => void>();

function mappaHaDimensioniCorrette(state: MappaRuntimeState): boolean {
  const costa = state.costaSudProfondita;
  return Array.isArray(costa) && costa.length === MAP_COLS;
}

function normalizzaSessioneMappa(state: MappaRuntimeState): MappaRuntimeState {
  // Dimensioni cambiate (es. 50×50 → 88×50): la sessione non è compatibile.
  if (!mappaHaDimensioniCorrette(state)) {
    return state;
  }
  let next = migraMappaCostaSud(state, MAP_COLS, MAP_ROWS);
  next = migraMappaBoscoDueRettangoliEFiume(next, MAP_COLS, MAP_ROWS);
  return next;
}

export function getMappaSessione(): MappaRuntimeState | null {
  if (mappaSessione && !mappaHaDimensioniCorrette(mappaSessione)) {
    return null;
  }
  return mappaSessione;
}

export function setMappaSessione(state: MappaRuntimeState | null): void {
  if (state != null && !mappaHaDimensioniCorrette(state)) {
    // Evita di tenere in RAM una mappa con griglia sbagliata.
    mappaSessione = null;
    setActiveCostaSud(null);
    listeners.forEach((listener) => listener());
    return;
  }
  const next = state == null ? null : normalizzaSessioneMappa(state);
  setActiveCostaSud(next?.costaSudProfondita ?? null);
  if (mappaSessione === next) return;
  mappaSessione = next;
  listeners.forEach((listener) => listener());
}

export function subscribeMappaSessione(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
