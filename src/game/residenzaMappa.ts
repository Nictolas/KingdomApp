import { edificiData } from "../data/edificiData";
import type { Abitante, Edificio } from "../types";
import { èResidenteFissoCastello, NOME_CASTELLO } from "./castelloGuardie";
import type { EdificioInCellaMappa } from "./mappaTypes";
import { getIndiciFootprint } from "./mappaGeometry";

export const NOMI_RESIDENZE_MAPPA = new Set(["Baracca", "Capanna", "Dormitorio"]);
export const POSTI_PER_CASA_MAPPA = 6;

export function getAnchorCellPerEdificio(
  cellIndex: number,
  edificiInMappa: Record<number, EdificioInCellaMappa>
): number {
  const e = edificiInMappa[cellIndex];
  if (!e) return cellIndex;
  if (e.footprintRef != null) return e.footprintRef;
  return cellIndex;
}

export function èResidenzaMappa(nome: string | undefined): boolean {
  return nome != null && NOMI_RESIDENZE_MAPPA.has(nome);
}

export function cellaÈNelFootprintResidenzaMappa(
  cellIndex: number,
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  cols: number
): boolean {
  const e = edificiInMappa[cellIndex];
  if (!e || !èResidenzaMappa(e.nome)) return false;
  const anchor = getAnchorCellPerEdificio(cellIndex, edificiInMappa);
  const cap = edificiInMappa[anchor];
  if (!cap || !èResidenzaMappa(cap.nome)) return false;
  const w = cap.footprint?.w ?? 1;
  const h = cap.footprint?.h ?? 1;
  return getIndiciFootprint(anchor, w, h, cols).includes(cellIndex);
}

export function residenzaGlobaleDi(abitanteId: number, edificiList: Edificio[]): Edificio | undefined {
  return edificiList.find((e) => e.tipo === "Residenza" && (e.abitantiAssegnati ?? []).includes(abitanteId));
}

function idEdificioGlobalePerNomeResidenza(nome: string): number | undefined {
  const found = edificiData.find((e) => e.nome === nome && e.tipo === "Residenza");
  return found?.id;
}

export function idGlobalePerResidenzaInCella(e: EdificioInCellaMappa | null, nome: string): number | undefined {
  if (!e) return undefined;
  if (e.edificioGlobaleId != null) return e.edificioGlobaleId;
  return idEdificioGlobalePerNomeResidenza(nome);
}

/** Celle anchor delle Capanne procedurali (un edificio 2×1 per anchor). */
export function elencoAnchorCelleCapanne(edificiInMappa: Record<number, EdificioInCellaMappa>): number[] {
  const anchors: number[] = [];
  for (const k of Object.keys(edificiInMappa)) {
    const idx = Number(k);
    const e = edificiInMappa[idx];
    if (!e || e.nome !== "Capanna") continue;
    const anchor = getAnchorCellPerEdificio(idx, edificiInMappa);
    if (anchor !== idx) continue;
    anchors.push(anchor);
  }
  anchors.sort((a, b) => a - b);
  return anchors;
}

/** Riparti i colonisti tra le capanne sulla mappa (max `postiPerCapanna` per anchor). */
export function distribuisciAbitantiSuAnchorCapanne(
  idsOrdinati: number[],
  anchors: number[],
  postiPerCapanna: number
): Record<number, number[]> {
  if (anchors.length === 0) return {};
  const out: Record<number, number[]> = {};
  for (const a of anchors) out[a] = [];
  let round = 0;
  for (const id of idsOrdinati) {
    let pos = -1;
    for (let t = 0; t < anchors.length; t++) {
      const i = (round + t) % anchors.length;
      const a = anchors[i]!;
      if (out[a]!.length < postiPerCapanna) {
        pos = i;
        break;
      }
    }
    if (pos < 0) {
      out[anchors[0]!]!.push(id);
    } else {
      const a = anchors[pos]!;
      out[a]!.push(id);
      round = (pos + 1) % anchors.length;
    }
  }
  return out;
}

/**
 * Se `residenzeMappa` è vuoto, simula la distribuzione iniziale dei residenti Capanna
 * (stessa logica della mappa al primo avvio).
 */
export function preparaResidenzeMappaPerLookup(
  edifici: Edificio[],
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  residenzeMappa: Record<number, number[]>
): Record<number, number[]> {
  if (Object.keys(residenzeMappa).length > 0) return residenzeMappa;
  const capannaGlob = edifici.find((x) => x.id === 20);
  const ids = [...(capannaGlob?.abitantiAssegnati ?? [])].sort((a, b) => a - b);
  if (ids.length === 0) return residenzeMappa;
  const anchors = elencoAnchorCelleCapanne(edificiInMappa);
  if (anchors.length === 0) return residenzeMappa;
  return distribuisciAbitantiSuAnchorCapanne(ids, anchors, POSTI_PER_CASA_MAPPA);
}

/**
 * Cella anchor della residenza sulla mappa (override `residenzeMappa` o edificio globale tipo Residenza).
 * `null` se non ha casa mappata.
 */
export function trovaCellaAnchorCasaSuMappa(
  abitanteId: number,
  edificiList: Edificio[],
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  residenzeMappa: Record<number, number[]>,
  abitante?: Abitante
): number | null {
  if (abitante && èResidenteFissoCastello(abitante)) {
    for (const k of Object.keys(edificiInMappa)) {
      const idx = Number(k);
      const edificio = edificiInMappa[idx];
      if (edificio?.nome === NOME_CASTELLO && getAnchorCellPerEdificio(idx, edificiInMappa) === idx) return idx;
    }
    return null;
  }
  for (const [anchorStr, ids] of Object.entries(residenzeMappa)) {
    if (ids.includes(abitanteId)) return Number(anchorStr);
  }
  const res = residenzaGlobaleDi(abitanteId, edificiList);
  if (!res || res.tipo !== "Residenza") return null;
  const targetId = res.id;
  for (const k of Object.keys(edificiInMappa)) {
    const idx = Number(k);
    const e = edificiInMappa[idx];
    if (!e || !èResidenzaMappa(e.nome)) continue;
    const anchor = getAnchorCellPerEdificio(idx, edificiInMappa);
    if (anchor !== idx) continue;
    const gid = idGlobalePerResidenzaInCella(e, e.nome);
    if (gid === targetId) return anchor;
  }
  return null;
}

/** Risolve l'anchor della casa di un abitante usando lo stato mappa (sessione o simulato). */
export function risolviAnchorCasaAbitante(
  abitanteId: number,
  edifici: Edificio[],
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  residenzeMappa: Record<number, number[]>
): number | null {
  const residenzeEff = preparaResidenzeMappaPerLookup(edifici, edificiInMappa, residenzeMappa);
  return trovaCellaAnchorCasaSuMappa(abitanteId, edifici, edificiInMappa, residenzeEff);
}
