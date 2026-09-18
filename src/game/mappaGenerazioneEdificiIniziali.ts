import type { EdificioInCellaMappa as EdificioInCella } from "./mappaTypes";
import {
  ADMIN_FOOTPRINT_H,
  ADMIN_FOOTPRINT_W,
  CAPANNA_FOOTPRINT_H,
  CAPANNA_FOOTPRINT_W,
  getIndiciEdificiIniziali
} from "./mappaLayoutConfig";
import { getIndiciFootprint, isAcqua } from "./mappaGeometry";
import { aggiungiComplessoAmministrativo } from "./mappaEdificioFootprints";
import {
  CAPANNA,
  GIACIMENTO,
  SERRA_2_EDIFICIO,
  SERRA_EDIFICIO
} from "./mappaEdificiStatici";
import {
  estendiVietatoConFootprintECuscino,
  trovaAnchorFootprintLibero,
  trovaCellaSingolaConCuscino,
  vietatoFootprintECuscinoDaEdificiIniziali
} from "./mappaPiazzamentoFootprint";
import {
  aggiungiBarFootprint,
  aggiungiDormitorioFootprint,
  aggiungiSerraFootprint,
  aggiungiSpazioportoFootprint,
  aggiungiTribunaleFootprint
} from "./mappaEdificiInizialiPiazzamento";

type RandomFn = () => number;

/** Restituisce edifici iniziali fissi, spostati su terra (no fiume, no mare); nessuna cella condivisa. */
export function getEdificiIniziali(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  adminAnchor: number
): Record<number, EdificioInCella> {
  const idx = getIndiciEdificiIniziali(cols, rows);
  const out: Record<number, EdificioInCella> = {};
  /** Footprint ∪ cuscino d'erba degli edifici già piazzati. */
  const vietato = new Set<number>();

  aggiungiComplessoAmministrativo(cols, rows, out, adminAnchor);
  estendiVietatoConFootprintECuscino(adminAnchor, ADMIN_FOOTPRINT_W, ADMIN_FOOTPRINT_H, cols, rows, vietato);

  aggiungiSpazioportoFootprint(cols, rows, riverSet, vietato, out, idx.SPAZIOPORTO_INDEX);

  aggiungiSerraFootprint(cols, rows, riverSet, vietato, out, idx.SERRA_INDEX, SERRA_EDIFICIO);
  aggiungiSerraFootprint(cols, rows, riverSet, vietato, out, idx.SERRA_2_INDEX, SERRA_2_EDIFICIO);

  aggiungiDormitorioFootprint(cols, rows, riverSet, vietato, out, idx.DORMITORIO_1_INDEX);
  aggiungiDormitorioFootprint(cols, rows, riverSet, vietato, out, idx.DORMITORIO_2_INDEX);
  aggiungiDormitorioFootprint(cols, rows, riverSet, vietato, out, idx.DORMITORIO_3_INDEX);

  aggiungiTribunaleFootprint(cols, rows, riverSet, vietato, out, idx.TRIBUNALE_INDEX);
  aggiungiBarFootprint(cols, rows, riverSet, vietato, out, idx.BAR_INDEX);

  return out;
}

/** Capanne 2×1 (o 1×1 se non c'è spazio) e giacimenti 1×1 senza sovrapposizioni al buffer d'erba. */
export function piazzaCapanneEgiacimentiProcedurali(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietatoBase: Set<number>,
  shuffled: number[],
  nCapanne: number,
  nGiacimento: number,
  random: RandomFn = Math.random
): { capanne: Record<number, EdificioInCella>; giacimenti: Record<number, EdificioInCella> } {
  const occupato = new Set(vietatoBase);
  const capanne: Record<number, EdificioInCella> = {};
  let placedC = 0;
  const w = CAPANNA_FOOTPRINT_W;
  const h = CAPANNA_FOOTPRINT_H;

  for (const pref of shuffled) {
    if (placedC >= nCapanne) break;
    const anchor = trovaAnchorFootprintLibero(w, h, pref, cols, rows, riverSet, occupato);
    if (anchor != null) {
      const celle = getIndiciFootprint(anchor, w, h, cols);
      capanne[anchor] = {
        id: CAPANNA.id,
        nome: CAPANNA.nome,
        emoji: "",
        footprint: { w, h }
      };
      for (const i of celle) {
        if (i === anchor) continue;
        capanne[i] = {
          id: CAPANNA.id,
          nome: CAPANNA.nome,
          emoji: "",
          footprintRef: anchor
        };
      }
      estendiVietatoConFootprintECuscino(anchor, w, h, cols, rows, occupato);
      placedC++;
      continue;
    }

    const cell = trovaCellaSingolaConCuscino(pref, cols, rows, riverSet, occupato);
    if (cell != null) {
      capanne[cell] = { ...CAPANNA };
      estendiVietatoConFootprintECuscino(cell, 1, 1, cols, rows, occupato);
      placedC++;
    }
  }

  const poolGi: number[] = [];
  const tot = cols * rows;
  for (let i = 0; i < tot; i++) {
    if (isAcqua(i, cols, rows) || riverSet.has(i) || occupato.has(i)) continue;
    poolGi.push(i);
  }
  poolGi.sort(() => random() - 0.5);

  const giacimenti: Record<number, EdificioInCella> = {};
  const nG = Math.min(nGiacimento, poolGi.length);
  for (let k = 0; k < nG; k++) {
    giacimenti[poolGi[k]!] = GIACIMENTO;
  }

  return { capanne, giacimenti };
}

/** Restituisce lo stato iniziale degli edifici; acqua e fiumi restano sempre non edificabili. */
export function getInitialEdificiInMappa(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  adminAnchor: number,
  random: RandomFn = Math.random
): Record<number, EdificioInCella> {
  const edificiIniziali = getEdificiIniziali(cols, rows, riverSet, adminAnchor);
  const totaleCelle = cols * rows;
  const vietatoEdifici = vietatoFootprintECuscinoDaEdificiIniziali(edificiIniziali, cols, rows);
  const erbaLibera: number[] = [];

  for (let i = 0; i < totaleCelle; i++) {
    if (!isAcqua(i, cols, rows) && !riverSet.has(i) && !vietatoEdifici.has(i)) erbaLibera.push(i);
  }

  const shuffled = [...erbaLibera].sort(() => random() - 0.5);
  const nCapanne = 5 + Math.floor(random() * 5);
  const nGiacimento = 2 + Math.floor(random() * 4);
  const { capanne, giacimenti } = piazzaCapanneEgiacimentiProcedurali(
    cols,
    rows,
    riverSet,
    vietatoEdifici,
    shuffled,
    nCapanne,
    nGiacimento,
    random
  );

  return { ...edificiIniziali, ...capanne, ...giacimenti };
}
