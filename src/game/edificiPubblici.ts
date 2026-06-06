import type { Abitante, Edificio } from "../types";
import { getCastaAbitante } from "./casta";
import { aggiungiMoneteInventarioAbitante } from "./inventario";
import { isGiocatore, puoEssereAssegnatoForzatamente } from "./schiavituCommercio";
import {
  isEdificioPubblicoConPostazioniLavoro
} from "./edificiLavoro";

/** Stipendio base: 1 moneta al giorno per ogni lavoratore negli edifici pubblici. */
export const STIPENDIO_BASE_MONETE_GIORNO = 1;

/** Giorni simulati per stipendi allo Skip Mese. */
export const GIORNI_STIPENDIO_EDIFICIO_PUBBLICO_MESE = 30;

export function getStipendioMoneteGiornaliero(_edificio: Edificio): number {
  return STIPENDIO_BASE_MONETE_GIORNO;
}

export function calcolaTotaleStipendiMonetePeriodo(edifici: Edificio[], giorni: number): number {
  if (giorni <= 0) return 0;
  let tot = 0;
  for (const edificio of edifici) {
    if (!isEdificioPubblicoConPostazioniLavoro(edificio)) continue;
    const n = (edificio.abitantiAssegnati ?? []).length;
    tot += n * getStipendioMoneteGiornaliero(edificio) * giorni;
  }
  return tot;
}

export function pagaStipendiEdificiPubblici(
  moneteGiocatore: number,
  abitanti: Abitante[],
  edifici: Edificio[],
  giorni: number
): { moneteGiocatore: number; abitanti: Abitante[] } {
  if (giorni <= 0) return { moneteGiocatore, abitanti };

  let monete = Math.max(0, moneteGiocatore);
  const abById = new Map(abitanti.map((a) => [a.id, a]));

  for (const edificio of edifici) {
    if (!isEdificioPubblicoConPostazioniLavoro(edificio)) continue;
    const importoGiorno = getStipendioMoneteGiornaliero(edificio);
    for (const id of edificio.abitantiAssegnati ?? []) {
      const ab = abById.get(id);
      if (!ab || isGiocatore(ab)) continue;
      const dovuto = importoGiorno * giorni;
      if (dovuto <= 0) continue;
      const pagato = Math.min(dovuto, monete);
      if (pagato <= 0) continue;
      monete -= pagato;
      abById.set(id, aggiungiMoneteInventarioAbitante(ab, pagato));
    }
  }

  return {
    moneteGiocatore: monete,
    abitanti: abitanti.map((a) => abById.get(a.id) ?? a)
  };
}

/** Tesoro iniziale del giocatore per stipendi edifici pubblici. */
export function creaMoneteGiocatoreIniziali(): number {
  return 500;
}

export function normalizzaMoneteGiocatore(quantità?: number): number {
  return Math.max(0, Math.floor(quantità ?? 0));
}
