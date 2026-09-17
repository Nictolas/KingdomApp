import type { EdificioInCellaMappa } from "./mappaTypes";
import { DORMITORIO_FOOTPRINT_H, DORMITORIO_FOOTPRINT_W } from "./mappaLayoutConfig";
import { getIndiciFootprint } from "./mappaGeometry";
import {
  estendiVietatoConFootprintECuscino,
  trovaAnchorFootprintLibero,
  trovaCellaSingolaConCuscino
} from "./mappaPiazzamentoFootprint";
import { DORMITORIO } from "./mappaEdificiStatici";

/** Piazza il dormitorio iniziale come footprint 2x2, con fallback 1x1 se necessario. */
export function aggiungiDormitorioFootprint(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>,
  out: Record<number, EdificioInCellaMappa>,
  preferred: number
): void {
  const w = DORMITORIO_FOOTPRINT_W;
  const h = DORMITORIO_FOOTPRINT_H;
  const anchor = trovaAnchorFootprintLibero(w, h, preferred, cols, rows, riverSet, vietato);
  if (anchor == null) {
    const cell = trovaCellaSingolaConCuscino(preferred, cols, rows, riverSet, vietato);
    if (cell != null) {
      out[cell] = { ...DORMITORIO };
      estendiVietatoConFootprintECuscino(cell, 1, 1, cols, rows, vietato);
    }
    return;
  }
  const celle = getIndiciFootprint(anchor, w, h, cols);
  out[anchor] = {
    id: DORMITORIO.id,
    nome: DORMITORIO.nome,
    emoji: "",
    footprint: { w, h }
  };
  for (const i of celle) {
    if (i === anchor) continue;
    out[i] = { id: DORMITORIO.id, nome: DORMITORIO.nome, emoji: "", footprintRef: anchor };
  }
  estendiVietatoConFootprintECuscino(anchor, w, h, cols, rows, vietato);
}
