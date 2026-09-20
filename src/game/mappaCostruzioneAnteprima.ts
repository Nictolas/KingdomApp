import type { Edificio } from "../types";
import type { TerrenoCostruzioneKind } from "./costruzioneSezioni";
import { FOOTPRINT_COSTRUZIONE } from "./mappaCostruzioneFootprints";
import {
  footprintDissalatoreMareSabbiaValido,
  trovaAnchorDissalatore
} from "./mappaDissalatorePiazzamento";
import { COSTRUZIONE_TERRENO_FOOTPRINT_H, COSTRUZIONE_TERRENO_FOOTPRINT_W } from "./mappaLayoutConfig";
import { getIndiciFootprint, isAcqua, riverSetDaTerreno } from "./mappaGeometry";
import {
  puòPiazzareFootprintConCuscino,
  trovaAnchorFootprintLibero,
  vietatoFootprintECuscinoDaEdificiIniziali
} from "./mappaPiazzamentoFootprint";
import type { EdificioInCellaMappa } from "./mappaTypes";
import { isTerrenoAcqua, type TerrenoType } from "./riverGeneration";
import { calcolaAnchorStrada2x2, footprintStrada2x2Valido } from "./stradaFootprint";
import { isCellaOkPerPonte } from "./ponteMappa";

/** Anteprima piazzamento in modalità Costruisci (stessa forma usata dalla mappa). */
export type SelezioneCostruzioneAnteprima =
  | { tipo: "strada" }
  | { tipo: "ponte" }
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

/** Verifica che l'anchor rispetti le stesse regole usate per costruire l'edificio. */
export function edificioRispettaCriteriPiazzamento(
  nomeEdificio: string,
  anchor: number,
  w: number,
  h: number,
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  terrenoInMappa: Record<number, TerrenoType>,
  cols: number,
  rows: number
): boolean {
  if (nomeEdificio === "Dissalatore") {
    return footprintDissalatoreMareSabbiaValido(anchor, cols, rows, terrenoInMappa, edificiInMappa);
  }
  const riverSet = riverSetDaTerreno(terrenoInMappa);
  const vietato = vietatoFootprintECuscinoDaEdificiIniziali(edificiInMappa, cols, rows);
  return puòPiazzareFootprintConCuscino(anchor, w, h, cols, rows, riverSet, vietato);
}

/** Stessa ricerca anchor usata dalla mappa per edifici multi-cella. */
export function calcolaAnchorEdificioMultiCella(
  cellIndex: number,
  nomeEdificio: string,
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  terrenoInMappa: Record<number, TerrenoType>,
  cols: number,
  rows: number
): { anchor: number | null; w: number; h: number } {
  const dim = FOOTPRINT_COSTRUZIONE[nomeEdificio] ?? { w: 1, h: 1 };
  const w = dim.w;
  const h = dim.h;
  if (nomeEdificio === "Dissalatore") {
    const anchor = trovaAnchorDissalatore(cellIndex, edificiInMappa, terrenoInMappa, cols, rows);
    return { anchor, w, h };
  }
  const riverSet = riverSetDaTerreno(terrenoInMappa);
  const vietato = vietatoFootprintECuscinoDaEdificiIniziali(edificiInMappa, cols, rows);
  let anchor: number | null = null;
  if (puòPiazzareFootprintConCuscino(cellIndex, w, h, cols, rows, riverSet, vietato)) {
    anchor = cellIndex;
  } else {
    anchor = trovaAnchorFootprintLibero(w, h, cellIndex, cols, rows, riverSet, vietato);
  }
  return { anchor, w, h };
}


/** Calcola celle e validità dell'anteprima di piazzamento mostrata dalla mappa. */
export function calcolaPreviewPiazzamento(
  selezione: SelezioneCostruzioneAnteprima,
  hoverCell: number | null,
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  terrenoInMappa: Record<number, TerrenoType>,
  cols: number,
  rows: number
): { celle: number[]; valido: boolean } | null {
  if (hoverCell == null) return null;
  if (selezione.tipo === "ponte") {
    return {
      celle: [hoverCell],
      valido: isCellaOkPerPonte(hoverCell, terrenoInMappa, edificiInMappa)
    };
  }
  if (selezione.tipo === "strada" || selezione.tipo === "terreno") {
    const { anchor, w, h } = calcolaAnchorCostruzione2x2(hoverCell, cols, rows);
    if (anchor == null) {
      return { celle: [hoverCell], valido: false };
    }
    const celle = getIndiciFootprint(anchor, w, h, cols);
    const valido =
      selezione.tipo === "strada"
        ? footprintStrada2x2Valido(anchor, cols, rows, terrenoInMappa, edificiInMappa)
        : footprintTerreno2x2Valido(
            selezione.kind,
            anchor,
            cols,
            rows,
            terrenoInMappa,
            edificiInMappa
          );
    return { celle, valido };
  }

  const e = selezione.edificio;
  const { anchor, w, h } = calcolaAnchorEdificioMultiCella(
    hoverCell,
    e.nome,
    edificiInMappa,
    terrenoInMappa,
    cols,
    rows
  );
  if (anchor == null) {
    const ac = hoverCell % cols;
    const ar = Math.floor(hoverCell / cols);
    if (ac + w > cols || ar + h > rows) {
      return { celle: [hoverCell], valido: false };
    }
    return { celle: getIndiciFootprint(hoverCell, w, h, cols), valido: false };
  }

  const celle = getIndiciFootprint(anchor, w, h, cols);
  const valido = edificioRispettaCriteriPiazzamento(
    e.nome,
    anchor,
    w,
    h,
    edificiInMappa,
    terrenoInMappa,
    cols,
    rows
  );
  return { celle, valido };
}
