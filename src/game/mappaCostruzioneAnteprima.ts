import type { Edificio } from "../types";
import type { TerrenoCostruzioneKind } from "./costruzioneSezioni";
import { calcolaAnchorStrada2x2 } from "./stradaFootprint";

/** Anteprima piazzamento in modalità Costruisci (stessa forma usata dalla mappa). */
export type SelezioneCostruzioneAnteprima =
  | { tipo: "strada" }
  | { tipo: "terreno"; kind: TerrenoCostruzioneKind }
  | { tipo: "edificio"; edificio: Edificio };

/** Strada / Acqua / Spiaggia / Erba: la modalità resta attiva fino a un secondo tap su Costruisci. */
export function costruzioneTerrenoPersistente(
  selezione: SelezioneCostruzioneAnteprima | null
): boolean {
  return selezione?.tipo === "strada" || selezione?.tipo === "terreno";
}

/** Anchor 2×2 che contiene `cellIndex` (Acqua / Spiaggia / Erba). */
export function calcolaAnchorCostruzione2x2(
  cellIndex: number,
  cols: number,
  rows: number
): { anchor: number | null; w: number; h: number } {
  return calcolaAnchorStrada2x2(cellIndex, cols, rows);
}
