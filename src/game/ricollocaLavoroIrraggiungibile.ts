/**
 * Se la postazione di lavoro non è raggiungibile a piedi, l’abitante lascia l’incarico,
 * cerca un altro posto raggiungibile e, in mancanza, va al Bosco come Raccoglitore.
 */

import type { Abitante, Edificio } from "../types";
import { getCastaAbitante } from "./casta";
import { èLavoroClero } from "./clero";
import {
  assumiDisoccupatoComeGuardia,
  èResidenteFissoCastello
} from "./castelloGuardie";
import { isGiocatore } from "./schiavituCommercio";
import {
  destinazioneLavoroOrarioPerAbitante,
  primoEdificioLavoroOrarioPerAbitante
} from "./orariLavoroMappa";
import { assumiCittadinoDisoccupatoInEdificio } from "./edificiLavoro";
import { assumiDisoccupatoInEmporio } from "./emporioLavoro";
import { assumiDisoccupatoNellaMiniera, NOME_MINIERA } from "./minieraRaccolta";
import {
  assumiDisoccupatoNelBosco,
  forzaAssunzioneRaccoglitoreNelBosco,
  LAVORO_RACCOGLITORE,
  NOME_BOSCO,
  type BottinoBoscoRegistrato
} from "./boscoRaccolta";
import {
  pianificaCommuteVersoEdificioGlobaleDaCella,
  sediCercaLavoroDisoccupatoInOrdine,
  type EdificioInCellaLike
} from "./commutePathsMappa";

export type RisultatoRicollocaLavoro = {
  abitanti: Abitante[];
  edifici: Edificio[];
  ricollocato: boolean;
  nuovoEdificioId?: number;
  pathVersoNuovo?: number[] | null;
  bottino?: BottinoBoscoRegistrato;
};

function abitanteEsclusoDaRicolloca(ab: Abitante): boolean {
  if (isGiocatore(ab)) return true;
  if (ab.razza === "Golem") return true;
  if (èResidenteFissoCastello(ab)) return true;
  if (getCastaAbitante(ab) === "Clero" || èLavoroClero(ab.lavoro)) return true;
  return false;
}

/** Toglie l’abitante dagli edifici di lavoro (non dalle Residenze). */
export function liberaDaEdificiLavoro(
  edifici: Edificio[],
  abitanteId: number
): Edificio[] {
  return edifici.map((e) => {
    if (e.tipo === "Residenza") return e;
    const att = e.abitantiAssegnati ?? [];
    if (!att.includes(abitanteId)) return e;
    const ids = att.filter((id) => id !== abitanteId);
    return { ...e, abitantiAssegnati: ids, occupazione: ids.length };
  });
}

function pathVersoEdificio(
  fromCell: number,
  edificioId: number,
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number[] | null {
  return pianificaCommuteVersoEdificioGlobaleDaCella(
    fromCell,
    edificioId,
    edificiInMappa,
    cols,
    rows,
    isWalkable
  );
}

function assumiInSede(
  abitanti: Abitante[],
  edifici: Edificio[],
  abitanteId: number,
  sede: Edificio
): {
  abitanti: Abitante[];
  edifici: Edificio[];
  ok: boolean;
  edificioId?: number;
  bottino?: BottinoBoscoRegistrato;
} {
  if (sede.nome === NOME_BOSCO) {
    const r = assumiDisoccupatoNelBosco(abitanti, edifici, abitanteId);
    return {
      abitanti: r.abitanti,
      edifici: r.edifici,
      ok: r.ok,
      edificioId: r.boscoId,
      bottino: r.bottino
    };
  }
  if (sede.nome === NOME_MINIERA) {
    const r = assumiDisoccupatoNellaMiniera(abitanti, edifici, abitanteId);
    return {
      abitanti: r.abitanti,
      edifici: r.edifici,
      ok: r.ok,
      edificioId: r.minieraId
    };
  }
  if (sede.nome === "Castello") {
    const r = assumiDisoccupatoComeGuardia(abitanti, edifici, abitanteId);
    return {
      abitanti: r.abitanti,
      edifici: r.edifici,
      ok: r.ok,
      edificioId: r.castelloId
    };
  }
  if (sede.nome === "Emporio") {
    const r = assumiDisoccupatoInEmporio(abitanti, edifici, abitanteId);
    return {
      abitanti: r.abitanti,
      edifici: r.edifici,
      ok: r.ok,
      edificioId: r.emporioId
    };
  }
  const r = assumiCittadinoDisoccupatoInEdificio(abitanti, edifici, abitanteId, sede.id);
  return {
    abitanti: r.abitanti,
    edifici: r.edifici,
    ok: r.ok,
    edificioId: r.ok ? sede.id : undefined
  };
}

/**
 * Se il lavoro attuale non è raggiungibile da `fromCell`, libera il posto e assume
 * altrove (priorità sedi cerca-lavoro raggiungibili); altrimenti forza il Bosco.
 */
export function ricollocaSeLavoroIrraggiungibile(
  abitanteId: number,
  abitanti: Abitante[],
  edifici: Edificio[],
  fromCell: number,
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): RisultatoRicollocaLavoro {
  const ab = abitanti.find((a) => a.id === abitanteId);
  if (!ab || abitanteEsclusoDaRicolloca(ab)) {
    return { abitanti, edifici, ricollocato: false };
  }

  const dest =
    destinazioneLavoroOrarioPerAbitante(abitanteId, edifici, abitanti) ??
    primoEdificioLavoroOrarioPerAbitante(abitanteId, edifici, abitanti);
  if (!dest) {
    return { abitanti, edifici, ricollocato: false };
  }

  const pathAttuale = pathVersoEdificio(
    fromCell,
    dest.id,
    edificiInMappa,
    cols,
    rows,
    isWalkable
  );
  // Path trovato (anche solo [cella] = già all’ingresso) ⇒ raggiungibile.
  if (pathAttuale != null && pathAttuale.length >= 1) {
    return { abitanti, edifici, ricollocato: false };
  }

  // Già Raccoglitore al Bosco ma irraggiungibile: non rimescolare ogni tick.
  if (dest.nome === NOME_BOSCO && ab.lavoro === LAVORO_RACCOGLITORE) {
    return { abitanti, edifici, ricollocato: false };
  }

  let edificiNext = liberaDaEdificiLavoro(edifici, abitanteId);
  let abitantiNext = abitanti.map((a) =>
    a.id === abitanteId ? { ...a, lavoro: "Disoccupato" } : a
  );
  const abDis = abitantiNext.find((a) => a.id === abitanteId)!;

  const candidati = sediCercaLavoroDisoccupatoInOrdine(abDis, edificiNext, abitantiNext).filter(
    (e) => e.id !== dest.id
  );

  for (const sede of candidati) {
    const path = pathVersoEdificio(fromCell, sede.id, edificiInMappa, cols, rows, isWalkable);
    if (path == null || path.length < 1) continue;
    const assunti = assumiInSede(abitantiNext, edificiNext, abitanteId, sede);
    if (!assunti.ok || assunti.edificioId == null) continue;
    return {
      abitanti: assunti.abitanti,
      edifici: assunti.edifici,
      ricollocato: true,
      nuovoEdificioId: assunti.edificioId,
      pathVersoNuovo: path.length >= 2 ? path : null,
      bottino: assunti.bottino
    };
  }

  const forzato = forzaAssunzioneRaccoglitoreNelBosco(abitantiNext, edificiNext, abitanteId);
  if (!forzato.ok || forzato.boscoId == null) {
    return { abitanti: abitantiNext, edifici: edificiNext, ricollocato: true };
  }
  const pathBosco = pathVersoEdificio(
    fromCell,
    forzato.boscoId,
    edificiInMappa,
    cols,
    rows,
    isWalkable
  );
  return {
    abitanti: forzato.abitanti,
    edifici: forzato.edifici,
    ricollocato: true,
    nuovoEdificioId: forzato.boscoId,
    pathVersoNuovo: pathBosco != null && pathBosco.length >= 2 ? pathBosco : null,
    bottino: forzato.bottino
  };
}
