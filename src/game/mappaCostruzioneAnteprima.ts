import type { Edificio } from "../types";
import type { TerrenoCostruzioneKind } from "./costruzioneSezioni";
import { COSTRUZIONE_TERRENO_FOOTPRINT_H, COSTRUZIONE_TERRENO_FOOTPRINT_W } from "./mappaLayoutConfig";
import { getIndiciFootprint, isAcqua } from "./mappaGeometry";
import type { EdificioInCellaMappa } from "./mappaTypes";
import { isTerrenoAcqua, type TerrenoType } from "./riverGeneration";
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

/** Verifica che il footprint 2×2 dell'anteprima terreno rispetti le regole correnti di costruzione. */
export function footprintTerreno2x2Valido(
  kind: TerrenoCostruzioneKind,
  anchor: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, EdificioInCellaMappa>
): boolean {
  const celle = getIndiciFootprint(
    anchor,
    COSTRUZIONE_TERRENO_FOOTPRINT_W,
    COSTRUZIONE_TERRENO_FOOTPRINT_H,
    cols
  );
  for (const i of celle) {
    if (edificiInMappa[i]) return false;
    if (kind === "acqua") {
      if (isAcqua(i, cols, rows)) continue;
      const t = terrenoInMappa[i] ?? "erba";
      if (t === "river") continue;
      if (t === "sabbia" || t === "erba") continue;
      return false;
    }
    if (kind === "spiaggia") {
      if (isTerrenoAcqua(i, terrenoInMappa, cols, rows)) return false;
      continue;
    }
    if (isTerrenoAcqua(i, terrenoInMappa, cols, rows)) return false;
  }
  return true;
}
