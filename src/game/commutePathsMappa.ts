import type { Abitante, Edificio } from "../types";
import { fasciaPerEdificio, minutiInFascia, primoEdificioLavoroOrarioPerAbitante } from "./orariLavoroMappa";
import {
  celleIngressoWalkableAttornoAdAnchor,
  orthogonalNeighbors,
  scegliCellaPartenzaWalkable,
  trovaCellaWalkablePiuVicina,
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

/**
 * Tra i Bar operativi presenti sulla mappa, sceglie quello col percorso più breve dalla cella di partenza.
 * Se `fromCellPreferita` è null, per ogni Bar usa l’anchor del Bar come punto di partenza (stesso criterio della vecchia logica “un solo Bar”).
 */
export function scegliBarEdificioIdPiuVicino(
  fromCellPreferita: number | null,
  edificiList: Edificio[],
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number | null {
  const barEdifici = edificiList.filter((e) => e.nome === "Bar" && e.stato === "Operativo");
  if (barEdifici.length === 0) return null;
  let bestId: number | null = null;
  let bestLen = Infinity;
  for (const e of barEdifici) {
    const anchor = trovaAnchorEdificioGlobaleSuMappa(e.id, edificiInMappa);
    if (anchor == null) continue;
    const from = fromCellPreferita ?? anchor;
    const path = calcolaPercorsoVersoAnchorEdificio(from, anchor, cols, rows, isWalkable);
    if (path == null) continue;
    if (path.length < bestLen) {
      bestLen = path.length;
      bestId = e.id;
    }
  }
  return bestId;
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
  if (start == null || !isWalkable(start)) {
    start =
      trovaCellaWalkablePiuVicina(fromCellPreferita, cols, rows, isWalkable) ??
      (isWalkable(fromCellPreferita) ? fromCellPreferita : null);
  }
  if (start == null || !isWalkable(start)) return null;

  return trovaPercorsoVersoCelle(start, goals, cols, rows, isWalkable);
}

export function pianificaCommuteVersoBarDaCella(
  fromCellPreferita: number,
  edificioBarGlobaleId: number,
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number[] | null {
  const bAnchor = trovaAnchorEdificioGlobaleSuMappa(edificioBarGlobaleId, edificiInMappa);
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

export type RisultatoCommuteMattina = {
  path: number[] | null;
  /** Presente se il percorso è verso un Bar (istanza in `edificiList`). */
  barEdificioId?: number;
};

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
): RisultatoCommuteMattina {
  if (abitante.razza === "Robot") return { path: null };

  const fromBase = homeAnchor ?? ultimaCellaNota;

  const pathVersoBar = (): RisultatoCommuteMattina => {
    const barId = scegliBarEdificioIdPiuVicino(fromBase, edificiList, edificiInMappa, cols, rows, isWalkable);
    if (barId == null) return { path: null };
    const bAnchor = trovaAnchorEdificioGlobaleSuMappa(barId, edificiInMappa);
    if (bAnchor == null) return { path: null };
    const from = fromBase ?? bAnchor;
    const path = calcolaPercorsoVersoAnchorEdificio(from, bAnchor, cols, rows, isWalkable);
    return path != null ? { path, barEdificioId: barId } : { path: null };
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
      const w = pathVersoLavoro();
      if (w != null && w.length >= 2) return { path: w };
      return pathVersoBar();
    }
    const b = pathVersoBar();
    if (b.path != null && b.path.length >= 2) return b;
    const w2 = pathVersoLavoro();
    return { path: w2 };
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
