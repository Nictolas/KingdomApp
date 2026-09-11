/**
 * Risolve la cella su cui centrare/puntare «Individua» per un abitante
 * (strada, casa o anchor edificio se è dentro).
 */

import type { Abitante, Edificio } from "../types";
import { getEdificiOccupazione } from "./abitanteEdifici";
import {
  trovaAnchorEdificioGlobaleSuMappa,
  type EdificioInCellaLike
} from "./commutePathsMappa";
import { reNascostoInEdificio } from "./disordineRe";
import {
  abitanteAlBarRoutineOra,
  abitanteInOrarioLavoroEdificio,
  destinazioneLavoroOrarioPerAbitante
} from "./orariLavoroMappa";
import { abitanteNascostoNelCultoOra } from "./presenzaLuogoCulto";
import { ID_GIOCATORE } from "./schiavituCommercio";
import type { ModalitaRe } from "./reModalita";

export type LocateMarkerMappa = {
  cell: number;
  abitanteId: number;
};

let pendingIndividuaAbitanteId: number | null = null;

export function setPendingIndividuaAbitanteId(id: number | null): void {
  pendingIndividuaAbitanteId = id;
}

export function consumePendingIndividuaAbitanteId(): number | null {
  const id = pendingIndividuaAbitanteId;
  pendingIndividuaAbitanteId = null;
  return id;
}

function edificioBarDiAbitante(
  abitanteId: number,
  barArrivatiByEdificio: Record<number, number[]>,
  edifici: Edificio[]
): Edificio | undefined {
  for (const [k, ids] of Object.entries(barArrivatiByEdificio)) {
    if (ids.includes(abitanteId)) {
      return edifici.find((e) => e.id === Number(k));
    }
  }
  return undefined;
}

function edificioCultoDiAbitante(
  abitanteId: number,
  cultoArrivatiByEdificio: Record<number, number[]>,
  edifici: Edificio[]
): Edificio | undefined {
  for (const [k, ids] of Object.entries(cultoArrivatiByEdificio)) {
    if (ids.includes(abitanteId)) {
      return edifici.find((e) => e.id === Number(k));
    }
  }
  return undefined;
}

function castelloAnchorSuMappa(edificiInMappa: Record<number, EdificioInCellaLike>): number | null {
  for (const key of Object.keys(edificiInMappa)) {
    const idx = Number(key);
    const e = edificiInMappa[idx];
    if (e?.nome === "Castello" && !e.footprintRef) return idx;
  }
  return null;
}

export function risolviCellaIndividuaAbitante(
  abitante: Abitante,
  opts: {
    ultimaCella: number | null | undefined;
    casa: number | null | undefined;
    edifici: Edificio[];
    edificiInMappa: Record<number, EdificioInCellaLike>;
    orologioMinuti: number;
    buioCielo: number;
    dormonoACasaIds: Set<number>;
    lavoroArrivatiIds: Set<number>;
    barArrivatiByEdificio: Record<number, number[]>;
    cultoArrivatiByEdificio: Record<number, number[]>;
    inCommute: boolean;
    modalitaRe?: ModalitaRe;
    reUscitaCastelloPending?: boolean;
  }
): number | null {
  const {
    ultimaCella,
    casa,
    edifici,
    edificiInMappa,
    orologioMinuti,
    buioCielo,
    dormonoACasaIds,
    lavoroArrivatiIds,
    barArrivatiByEdificio,
    cultoArrivatiByEdificio,
    inCommute,
    modalitaRe,
    reUscitaCastelloPending
  } = opts;

  const castello = castelloAnchorSuMappa(edificiInMappa);

  if (abitante.id === ID_GIOCATORE) {
    if (inCommute) return ultimaCella ?? casa ?? castello ?? null;
    if (reNascostoInEdificio(modalitaRe ?? "nel_castello") || reUscitaCastelloPending) {
      return castello ?? casa ?? ultimaCella ?? null;
    }
    if (modalitaRe === "a_giro") {
      return ultimaCella ?? casa ?? castello ?? null;
    }
    return casa ?? castello ?? ultimaCella ?? null;
  }

  if (inCommute) {
    return ultimaCella ?? casa ?? null;
  }

  if (
    abitanteInOrarioLavoroEdificio(abitante.id, orologioMinuti, edifici, [abitante]) &&
    lavoroArrivatiIds.has(abitante.id)
  ) {
    const sede =
      destinazioneLavoroOrarioPerAbitante(abitante.id, edifici, [abitante]) ??
      getEdificiOccupazione(abitante.id, edifici)[0];
    if (sede) {
      const anchor = trovaAnchorEdificioGlobaleSuMappa(sede.id, edificiInMappa);
      if (anchor != null) return anchor;
    }
  }

  if (
    abitanteAlBarRoutineOra(abitante, orologioMinuti, buioCielo, edifici) &&
    Object.values(barArrivatiByEdificio).some((ids) => ids.includes(abitante.id))
  ) {
    const bar = edificioBarDiAbitante(abitante.id, barArrivatiByEdificio, edifici);
    if (bar) {
      const anchor = trovaAnchorEdificioGlobaleSuMappa(bar.id, edificiInMappa);
      if (anchor != null) return anchor;
    }
  }

  if (abitanteNascostoNelCultoOra(abitante, orologioMinuti, buioCielo, cultoArrivatiByEdificio)) {
    const culto = edificioCultoDiAbitante(abitante.id, cultoArrivatiByEdificio, edifici);
    if (culto) {
      const anchor = trovaAnchorEdificioGlobaleSuMappa(culto.id, edificiInMappa);
      if (anchor != null) return anchor;
    }
  }

  if (casa != null && dormonoACasaIds.has(abitante.id)) {
    return casa;
  }

  return ultimaCella ?? casa ?? null;
}
