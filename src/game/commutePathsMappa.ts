import type { Abitante, Edificio } from "../types";
import { fasciaPerEdificio, minutiInFascia, primoEdificioLavoroOrarioPerAbitante } from "./orariLavoroMappa";
import {
  celleIngressoWalkableAttornoAdAnchor,
  orthogonalNeighbors,
  scegliCellaPartenzaWalkable,
  trovaPercorsoVersoCelle
} from "./mappaPathfinding";

/** Minimo tipo per celle edificio sulla mappa (come in app/mappa). */
export type EdificioInCellaLike = {
  id: number;
  nome: string;
  edificioGlobaleId?: number;
  footprintRef?: number;
  footprint?: { w: number; h: number };
};

export function getAnchorCellPerEdificio(
  cellIndex: number,
  edificiInMappa: Record<number, EdificioInCellaLike>
): number {
  const e = edificiInMappa[cellIndex];
  if (!e) return cellIndex;
  if (e.footprintRef != null) return e.footprintRef;
  return cellIndex;
}

export function trovaAnchorEdificioGlobaleSuMappa(
  edificioGlobaleId: number,
  edificiInMappa: Record<number, EdificioInCellaLike>
): number | null {
  for (const k of Object.keys(edificiInMappa)) {
    const idx = Number(k);
    const e = edificiInMappa[idx];
    if (!e) continue;
    const anchor = getAnchorCellPerEdificio(idx, edificiInMappa);
    if (anchor !== idx) continue;
    const gid = e.edificioGlobaleId ?? e.id;
    if (gid === edificioGlobaleId) return anchor;
  }
  return null;
}

export function trovaAnchorBarSuMappa(edificiInMappa: Record<number, EdificioInCellaLike>): number | null {
  for (const k of Object.keys(edificiInMappa)) {
    const idx = Number(k);
    const e = edificiInMappa[idx];
    if (!e || e.nome !== "Bar") continue;
    const anchor = getAnchorCellPerEdificio(idx, edificiInMappa);
    if (anchor === idx) return anchor;
  }
  return null;
}

export function calcolaPercorsoVersoAnchorEdificio(
  fromCellPreferita: number,
  anchorDest: number,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number[] | null {
  const goals = new Set(
    celleIngressoWalkableAttornoAdAnchor(anchorDest, cols, rows, isWalkable)
  );
  if (goals.size === 0) {
    const nb = orthogonalNeighbors(anchorDest, cols, rows).filter(isWalkable);
    for (const n of nb) goals.add(n);
  }
  if (goals.size === 0) return null;

  let start = scegliCellaPartenzaWalkable(fromCellPreferita, anchorDest, cols, rows, isWalkable);
  if (start == null) start = fromCellPreferita;
  if (!isWalkable(start)) {
    for (const g of goals) {
      start = g;
      break;
    }
  }

  return trovaPercorsoVersoCelle(start, goals, cols, rows, isWalkable);
}

export function pianificaCommuteVersoBarDaCella(
  fromCellPreferita: number,
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number[] | null {
  const bAnchor = trovaAnchorBarSuMappa(edificiInMappa);
  if (bAnchor == null) return null;
  return calcolaPercorsoVersoAnchorEdificio(fromCellPreferita, bAnchor, cols, rows, isWalkable);
}

export function pianificaCommuteVersoEdificioGlobaleDaCella(
  fromCellPreferita: number,
  edificioGlobaleId: number,
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number[] | null {
  const wAnchor = trovaAnchorEdificioGlobaleSuMappa(edificioGlobaleId, edificiInMappa);
  if (wAnchor == null) return null;
  return calcolaPercorsoVersoAnchorEdificio(fromCellPreferita, wAnchor, cols, rows, isWalkable);
}

/**
 * All’alba: fuori fascia lavoro → Bar; in fascia (es. dopo le 8:00) → primo edificio con orario.
 */
export function pianificaCommuteMattina(
  abitante: Abitante,
  homeAnchor: number | null,
  ultimaCellaNota: number | null,
  edificiList: Edificio[],
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean,
  minutiDaMezzanotte: number
): number[] | null {
  if (abitante.razza === "Robot") return null;

  const fromBase = homeAnchor ?? ultimaCellaNota;

  const pathVersoBar = (): number[] | null => {
    const bAnchor = trovaAnchorBarSuMappa(edificiInMappa);
    if (bAnchor == null) return null;
    const from = fromBase ?? bAnchor;
    return calcolaPercorsoVersoAnchorEdificio(from, bAnchor, cols, rows, isWalkable);
  };

  const pathVersoLavoro = (): number[] | null => {
    const lavoro = primoEdificioLavoroOrarioPerAbitante(abitante.id, edificiList);
    if (!lavoro) return null;
    const wAnchor = trovaAnchorEdificioGlobaleSuMappa(lavoro.id, edificiInMappa);
    if (wAnchor == null) return null;
    const from = fromBase ?? wAnchor;
    return calcolaPercorsoVersoAnchorEdificio(from, wAnchor, cols, rows, isWalkable);
  };

  const lavoro = primoEdificioLavoroOrarioPerAbitante(abitante.id, edificiList);
  if (lavoro) {
    const fascia = fasciaPerEdificio(lavoro);
    if (fascia && minutiInFascia(minutiDaMezzanotte, fascia)) {
      return pathVersoLavoro() ?? pathVersoBar();
    }
    return pathVersoBar() ?? pathVersoLavoro();
  }

  return pathVersoBar();
}

export function pianificaCommuteSeraACasa(
  homeAnchor: number,
  fromCell: number,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number[] | null {
  return calcolaPercorsoVersoAnchorEdificio(fromCell, homeAnchor, cols, rows, isWalkable);
}
