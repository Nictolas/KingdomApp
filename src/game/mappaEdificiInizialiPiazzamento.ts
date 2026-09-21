import type { EdificioInCellaMappa } from "./mappaTypes";
import {
  BAR_FOOTPRINT_H,
  BAR_FOOTPRINT_W,
  DORMITORIO_FOOTPRINT_H,
  DORMITORIO_FOOTPRINT_W,
  SERRA_FOOTPRINT_H,
  SERRA_FOOTPRINT_W,
  TRIBUNALE_FOOTPRINT_H,
  TRIBUNALE_FOOTPRINT_W
} from "./mappaLayoutConfig";
import { getIndiciFootprint } from "./mappaGeometry";
import {
  estendiVietatoConFootprintECuscino,
  trovaAnchorFootprintLibero,
  trovaCellaSingolaConCuscino
} from "./mappaPiazzamentoFootprint";
import {
  BAR_EDIFICIO,
  DORMITORIO,
  TRIBUNALE_EDIFICIO
} from "./mappaEdificiStatici";

function aggiungiFootprintIniziale(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>,
  out: Record<number, EdificioInCellaMappa>,
  preferred: number,
  spec: EdificioInCellaMappa,
  w: number,
  h: number
): void {
  const anchor = trovaAnchorFootprintLibero(w, h, preferred, cols, rows, riverSet, vietato);
  if (anchor == null) {
    const cell = trovaCellaSingolaConCuscino(preferred, cols, rows, riverSet, vietato);
    if (cell != null) {
      out[cell] = { ...spec };
      estendiVietatoConFootprintECuscino(cell, 1, 1, cols, rows, vietato);
    }
    return;
  }

  const celle = getIndiciFootprint(anchor, w, h, cols);
  out[anchor] = {
    id: spec.id,
    nome: spec.nome,
    emoji: "",
    footprint: { w, h }
  };
  for (const i of celle) {
    if (i === anchor) continue;
    out[i] = {
      id: spec.id,
      nome: spec.nome,
      emoji: "",
      footprintRef: anchor
    };
  }
  estendiVietatoConFootprintECuscino(anchor, w, h, cols, rows, vietato);
}

/** Piazza il dormitorio iniziale come footprint 2x2, con fallback 1x1 se necessario. */
export function aggiungiDormitorioFootprint(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>,
  out: Record<number, EdificioInCellaMappa>,
  preferred: number
): void {
  aggiungiFootprintIniziale(
    cols,
    rows,
    riverSet,
    vietato,
    out,
    preferred,
    DORMITORIO,
    DORMITORIO_FOOTPRINT_W,
    DORMITORIO_FOOTPRINT_H
  );
}

/** Piazza il bar iniziale come footprint, con fallback 1x1 se necessario. */
export function aggiungiBarFootprint(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>,
  out: Record<number, EdificioInCellaMappa>,
  preferred: number
): void {
  aggiungiFootprintIniziale(
    cols,
    rows,
    riverSet,
    vietato,
    out,
    preferred,
    BAR_EDIFICIO,
    BAR_FOOTPRINT_W,
    BAR_FOOTPRINT_H
  );
}

/** Piazza il tribunale iniziale come footprint, con fallback 1x1 se necessario. */
export function aggiungiTribunaleFootprint(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>,
  out: Record<number, EdificioInCellaMappa>,
  preferred: number
): void {
  aggiungiFootprintIniziale(
    cols,
    rows,
    riverSet,
    vietato,
    out,
    preferred,
    TRIBUNALE_EDIFICIO,
    TRIBUNALE_FOOTPRINT_W,
    TRIBUNALE_FOOTPRINT_H
  );
}

/** Piazza una serra iniziale come footprint, con fallback 1x1 se necessario. */
export function aggiungiSerraFootprint(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>,
  out: Record<number, EdificioInCellaMappa>,
  preferred: number,
  spec: EdificioInCellaMappa
): void {
  aggiungiFootprintIniziale(
    cols,
    rows,
    riverSet,
    vietato,
    out,
    preferred,
    spec,
    SERRA_FOOTPRINT_W,
    SERRA_FOOTPRINT_H
  );
}
