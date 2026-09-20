/**
 * Calcoli fiscali puri: reddito, patrimonio, IVA.
 * Gettito → Tesoro; reddito/patrimonio prelevano dagli inventari personali.
 */

import type { Abitante, Edificio } from "../types";
import { getProduzioneCiboPerAbitante } from "./ciboConsumo";
import { abitanteHaInventarioPersonale } from "./casta";
import {
  getMoneteInventarioAbitante,
  setMoneteInventarioAbitante
} from "./inventario";
import {
  PREZZO_UNITA_VALORE_AGGIUNTO,
  TASSA_PATRIMONIO_PERCENTUALE_DEFAULT,
  IVA_PERCENTUALE_DEFAULT
} from "./economiaPrezzi";

/** Unità IVA stimate per lavoratore su output non-cibo (indipendenti dalla Produttività). */
const UNITA_IVA_PER_LAVORATORE = 5;

export type ScaglioneTassa = { min: number; max: number; percentuale: number };

export type ConfigTassaReddito = {
  tipo: "flat" | "scaglioni";
  flatPercentuale: number;
  scaglioni: ScaglioneTassa[];
};

export { TASSA_PATRIMONIO_PERCENTUALE_DEFAULT, IVA_PERCENTUALE_DEFAULT };

export function calcolaTassaRedditoImporto(
  reddito: number,
  config: ConfigTassaReddito
): number {
  const r = Math.max(0, Math.floor(reddito));
  if (r <= 0) return 0;
  if (config.tipo === "flat") {
    return Math.floor(r * (Math.max(0, config.flatPercentuale) / 100));
  }
  let tassaTotale = 0;
  let redditoProcessato = 0;
  for (const scaglione of config.scaglioni) {
    if (r <= redditoProcessato) break;
    const inizioScaglione = Math.max(scaglione.min - 1, redditoProcessato);
    const fineScaglione = scaglione.max === Infinity ? r : Math.min(scaglione.max, r);
    if (fineScaglione > inizioScaglione) {
      const redditoInScaglione = fineScaglione - inizioScaglione;
      tassaTotale += Math.floor(redditoInScaglione * (scaglione.percentuale / 100));
      redditoProcessato = fineScaglione;
    }
  }
  return tassaTotale;
}

export function calcolaTassaPatrimonioImporto(
  moneteInventario: number,
  percentuale: number
): number {
  const m = Math.max(0, Math.floor(moneteInventario));
  const p = Math.max(0, percentuale);
  if (m <= 0 || p <= 0) return 0;
  return Math.floor(m * (p / 100));
}

/** Unità di output mensile stimate per un edificio operativo con produzione. */
export function stimaUnitaProduzioneEdificio(
  edificio: Edificio,
  abitanti: Abitante[],
  edificioBuffVisitaId?: number | null
): number {
  if (edificio.stato !== "Operativo" || !edificio.produzione) return 0;
  const ids = edificio.abitantiAssegnati ?? [];
  const num = ids.length;
  if (num <= 0) return 0;

  const buff = edificio.id === edificioBuffVisitaId ? 1.15 : 1;
  const produzioni = edificio.produzione.split(",").map((p) => p.trim()).filter(Boolean);
  let unita = 0;

  for (const prod of produzioni) {
    const isCibo = prod.toLowerCase().includes("cibo");
    if (isCibo || edificio.nome === "Serra") {
      const totale = ids.reduce((sum, id) => sum + getProduzioneCiboPerAbitante(id), 0);
      unita += Math.floor(totale * buff);
      continue;
    }
    // Output non-cibo: stima fissa per lavoratore (non dipende dalla Produttività).
    unita += Math.floor(num * UNITA_IVA_PER_LAVORATORE * buff);
  }
  return unita;
}

export function stimaValoreProduzioneRegno(
  edifici: Edificio[],
  abitanti: Abitante[],
  edificioBuffVisitaId?: number | null
): number {
  let totaleUnita = 0;
  for (const e of edifici) {
    totaleUnita += stimaUnitaProduzioneEdificio(e, abitanti, edificioBuffVisitaId);
  }
  return totaleUnita * PREZZO_UNITA_VALORE_AGGIUNTO;
}

export function calcolaIvaImporto(valoreProduzione: number, percentuale: number): number {
  const v = Math.max(0, Math.floor(valoreProduzione));
  const p = Math.max(0, percentuale);
  if (v <= 0 || p <= 0) return 0;
  return Math.floor(v * (p / 100));
}

export type RisultatoTasseMensili = {
  abitanti: Abitante[];
  gettitoReddito: number;
  gettitoPatrimonio: number;
  gettitoIva: number;
};

/**
 * Applica tasse dopo redditi/affitti: preleva da inventari (reddito + patrimonio),
 * calcola IVA sul valore produzione (solo gettito Tesoro).
 */
export function applicaTasseMensili(input: {
  abitanti: Abitante[];
  edifici: Edificio[];
  configReddito: ConfigTassaReddito;
  tassaPatrimonioPercentuale: number;
  ivaPercentuale: number;
  edificioBuffVisitaId?: number | null;
}): RisultatoTasseMensili {
  const {
    configReddito,
    tassaPatrimonioPercentuale,
    ivaPercentuale,
    edifici,
    edificioBuffVisitaId
  } = input;

  let gettitoReddito = 0;
  let gettitoPatrimonio = 0;

  const abitanti = input.abitanti.map((a) => {
    if (a.razza === "Golem" || !abitanteHaInventarioPersonale(a)) return a;

    let monete = getMoneteInventarioAbitante(a.inventario);

    const tassaReddito = calcolaTassaRedditoImporto(a.reddito ?? 0, configReddito);
    const prelievoReddito = Math.min(monete, tassaReddito);
    monete -= prelievoReddito;
    gettitoReddito += prelievoReddito;

    const tassaPatrimonio = calcolaTassaPatrimonioImporto(monete, tassaPatrimonioPercentuale);
    const prelievoPatrimonio = Math.min(monete, tassaPatrimonio);
    monete -= prelievoPatrimonio;
    gettitoPatrimonio += prelievoPatrimonio;

    if (prelievoReddito === 0 && prelievoPatrimonio === 0) return a;
    return setMoneteInventarioAbitante(a, monete);
  });

  const valoreProd = stimaValoreProduzioneRegno(edifici, abitanti, edificioBuffVisitaId);
  const gettitoIva = calcolaIvaImporto(valoreProd, ivaPercentuale);

  return { abitanti, gettitoReddito, gettitoPatrimonio, gettitoIva };
}

/** Stima gettito senza mutare stato (UI bilancio / anteprima). */
export function stimaGettitoTasse(input: {
  abitanti: Abitante[];
  edifici: Edificio[];
  configReddito: ConfigTassaReddito;
  tassaPatrimonioPercentuale: number;
  ivaPercentuale: number;
  edificioBuffVisitaId?: number | null;
}): { reddito: number; patrimonio: number; iva: number; totale: number } {
  let reddito = 0;
  let patrimonio = 0;
  for (const a of input.abitanti) {
    if (a.razza === "Golem" || !abitanteHaInventarioPersonale(a)) continue;
    const monete = getMoneteInventarioAbitante(a.inventario);
    const tR = calcolaTassaRedditoImporto(a.reddito ?? 0, input.configReddito);
    reddito += Math.min(monete, tR);
    const dopoReddito = Math.max(0, monete - tR);
    patrimonio += calcolaTassaPatrimonioImporto(dopoReddito, input.tassaPatrimonioPercentuale);
  }
  const valore = stimaValoreProduzioneRegno(
    input.edifici,
    input.abitanti,
    input.edificioBuffVisitaId
  );
  const iva = calcolaIvaImporto(valore, input.ivaPercentuale);
  return { reddito, patrimonio, iva, totale: reddito + patrimonio + iva };
}
