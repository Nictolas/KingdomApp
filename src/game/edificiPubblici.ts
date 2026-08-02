import type { Abitante, Edificio } from "../types";
import { aggiungiMoneteInventarioAbitante } from "./inventario";
import { isGiocatore } from "./schiavituCommercio";
import {
  isEdificioPubblicoConPostazioniLavoro
} from "./edificiLavoro";
import {
  GIORNI_MESE_ECONOMIA,
  MONETE_GIOCATORE_INIZIALI,
  STIPENDIO_BASE_MONETE_GIORNO,
  STIPENDIO_BASE_MONETE_MESE
} from "./economiaPrezzi";

/** Stipendio base: 1 moneta al giorno per ogni lavoratore negli edifici pubblici. */
export { STIPENDIO_BASE_MONETE_GIORNO };

/** Giorni simulati per stipendi allo Skip Mese. */
export const GIORNI_STIPENDIO_EDIFICIO_PUBBLICO_MESE = GIORNI_MESE_ECONOMIA;

/**
 * Stipendio mensile configurato sull'edificio (monete/mese per lavoratore).
 * Se assente → default base.
 */
export function getStipendioMensileEdificio(edificio: Edificio): number {
  const raw = edificio.stipendioPerLavoratore;
  if (raw == null || !Number.isFinite(raw) || raw < 0) return STIPENDIO_BASE_MONETE_MESE;
  return Math.floor(raw);
}

/**
 * Pagamento giornaliero da mensile: max(1, round(mensile/30)), oppure 0 se mensile 0.
 */
export function getStipendioMoneteGiornaliero(edificio: Edificio): number {
  const mensile = getStipendioMensileEdificio(edificio);
  if (mensile <= 0) return 0;
  return Math.max(1, Math.round(mensile / GIORNI_MESE_ECONOMIA));
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

/** Totale stipendi mensili previsti (monete) per edifici pubblici operativi. */
export function calcolaTotaleStipendiMensiliEdificiPubblici(edifici: Edificio[]): number {
  let tot = 0;
  for (const edificio of edifici) {
    if (!isEdificioPubblicoConPostazioniLavoro(edificio)) continue;
    if (edificio.stato !== "Operativo") continue;
    const n = (edificio.abitantiAssegnati ?? []).length;
    tot += n * getStipendioMensileEdificio(edificio);
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
  return MONETE_GIOCATORE_INIZIALI;
}

export function normalizzaMoneteGiocatore(quantità?: number): number {
  return Math.max(0, Math.floor(quantità ?? 0));
}
