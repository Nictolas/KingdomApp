/**
 * Cassa Impresa: entrate clienti, stipendi privati, tassa mensile sul fatturato.
 * Il Bosco non ha payroll da cassa (guadagno via vendita Emporio).
 */

import type { Abitante, Edificio } from "../types";
import { getCastaAbitante } from "./casta";
import { CASSA_IMPRESA_SEED, TASSA_IMPRESA_PERCENTUALE } from "./economiaPrezzi";
import { getStipendioMoneteGiornaliero } from "./edificiPubblici";
import { isEdificioImpresa } from "./edificiLavoro";
import { aggiungiMoneteInventarioAbitante } from "./inventario";
import { isGiocatore } from "./schiavituCommercio";

/** Imprese con cassa e stipendio da cassa (esclude Bosco, Miniera e Serra). */
export function impresaHaPayrollDaCassa(edificio: Edificio): boolean {
  if (!isEdificioImpresa(edificio)) return false;
  // Miniera / Serra: produzione per il regno → stipendi dal Tesoro, non dalla cassa.
  if (edificio.nome === "Bosco" || edificio.nome === "Miniera" || edificio.nome === "Serra") {
    return false;
  }
  return edificio.stato === "Operativo";
}

/** Bar: fisso + tip a fine turno lavoro (non nel tick giornaliero generico). */
export function impresaPagaStipendioNelTickGiornaliero(edificio: Edificio): boolean {
  return impresaHaPayrollDaCassa(edificio) && edificio.nome !== "Bar";
}

export function getCassaImpresa(edificio: Edificio): number {
  const raw = edificio.cassaMonete;
  if (raw == null || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

export function getFatturatoMeseImpresa(edificio: Edificio): number {
  const raw = edificio.fatturatoMeseMonete;
  if (raw == null || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

/** Seed cassa se Impresa non-Bosco/Miniera e campo assente. */
export function seedCassaImpresaSeMancante(edificio: Edificio): Edificio {
  if (!isEdificioImpresa(edificio) || edificio.nome === "Bosco" || edificio.nome === "Miniera") {
    return edificio;
  }
  if (edificio.cassaMonete != null && Number.isFinite(edificio.cassaMonete)) {
    return {
      ...edificio,
      cassaMonete: Math.max(0, Math.floor(edificio.cassaMonete))
    };
  }
  return { ...edificio, cassaMonete: CASSA_IMPRESA_SEED };
}

export function normalizzaEdificiCassaImpresa(
  edifici: Edificio[],
  casseBarLegacy?: Record<number, number>
): Edificio[] {
  return edifici.map((e) => {
    let next = seedCassaImpresaSeMancante(e);
    if (casseBarLegacy && e.nome === "Bar") {
      const legacy = casseBarLegacy[e.id];
      if (legacy != null && Number.isFinite(legacy) && legacy > 0) {
        next = {
          ...next,
          cassaMonete: getCassaImpresa(next) + Math.floor(legacy)
        };
      }
    }
    return next;
  });
}

/** Incassa monete clienti nella cassa e nel fatturato mese. */
export function aggiungiIncassoImpresa(edificio: Edificio, monete: number): Edificio {
  if (monete <= 0) return edificio;
  const add = Math.floor(monete);
  return {
    ...edificio,
    cassaMonete: getCassaImpresa(edificio) + add,
    fatturatoMeseMonete: getFatturatoMeseImpresa(edificio) + add
  };
}

/**
 * Preleva da cassa (max disponibile). Restituisce edificio aggiornato e monete ottenute.
 */
export function provaPagaDaCassa(
  edificio: Edificio,
  dovuto: number
): { edificio: Edificio; pagato: number } {
  const want = Math.max(0, Math.floor(dovuto));
  if (want <= 0) return { edificio, pagato: 0 };
  const cassa = getCassaImpresa(edificio);
  const pagato = Math.min(want, cassa);
  if (pagato <= 0) return { edificio, pagato: 0 };
  const resto = cassa - pagato;
  return {
    edificio: {
      ...edificio,
      cassaMonete: resto > 0 ? resto : 0
    },
    pagato
  };
}

/**
 * Stipendi giornalieri imprese (Emporio, Fucina, …) da Cassa.
 * Esclude Bar (pagato a fine turno) e Bosco.
 */
export function pagaStipendiImpresaGiornalieri(
  abitanti: Abitante[],
  edifici: Edificio[],
  giorni: number
): { abitanti: Abitante[]; edifici: Edificio[] } {
  if (giorni <= 0) return { abitanti, edifici };

  const abById = new Map(abitanti.map((a) => [a.id, a]));
  const edificiNext = edifici.map((edificio) => {
    if (!impresaPagaStipendioNelTickGiornaliero(edificio)) return edificio;
    const importoGiorno = getStipendioMoneteGiornaliero(edificio);
    if (importoGiorno <= 0) return edificio;

    let ed = edificio;
    for (const id of edificio.abitantiAssegnati ?? []) {
      const ab = abById.get(id);
      if (!ab || isGiocatore(ab)) continue;
      if (getCastaAbitante(ab) === "Clero") continue;
      const dovuto = importoGiorno * giorni;
      const { edificio: ed2, pagato } = provaPagaDaCassa(ed, dovuto);
      ed = ed2;
      if (pagato > 0) {
        abById.set(id, aggiungiMoneteInventarioAbitante(ab, pagato));
      }
    }
    return ed;
  });

  return {
    abitanti: abitanti.map((a) => abById.get(a.id) ?? a),
    edifici: edificiNext
  };
}

/**
 * A fine turno Bar: (1) stipendio fisso ai baristi in servizio, (2) tip = residuo cassa diviso.
 * Resto non divisibile resta in cassa.
 */
export function pagaFissoEDistribuisciTipBar(
  edifici: Edificio[],
  baristiInServizioByBar: Record<number, number[]>,
  aggiornaAbitante: (abitanteId: number, fn: (a: Abitante) => Abitante) => void
): Edificio[] {
  return edifici.map((edificio) => {
    if (edificio.nome !== "Bar") return edificio;
    const ids = [...new Set(baristiInServizioByBar[edificio.id] ?? [])].filter((id) =>
      Number.isFinite(id)
    );
    if (ids.length === 0) return edificio;

    let ed = edificio;
    const fisso = getStipendioMoneteGiornaliero(edificio);
    if (fisso > 0) {
      for (const id of ids) {
        const { edificio: ed2, pagato } = provaPagaDaCassa(ed, fisso);
        ed = ed2;
        if (pagato > 0) {
          aggiornaAbitante(id, (a) => aggiungiMoneteInventarioAbitante(a, pagato));
        }
      }
    }

    const totale = getCassaImpresa(ed);
    if (totale <= 0) return { ...ed, cassaMonete: 0 };
    const quota = Math.floor(totale / ids.length);
    const resto = totale - quota * ids.length;
    if (quota > 0) {
      for (const id of ids) {
        aggiornaAbitante(id, (a) => aggiungiMoneteInventarioAbitante(a, quota));
      }
    }
    return { ...ed, cassaMonete: resto > 0 ? resto : 0 };
  });
}

/** Tassa impresa: % fatturato mese da Cassa → Tesoro; azzera fatturato. */
export function prelevaTassaImpresaMensile(
  edifici: Edificio[],
  moneteGiocatore: number,
  aliquotaPercentuale: number = TASSA_IMPRESA_PERCENTUALE
): { edifici: Edificio[]; moneteGiocatore: number; gettito: number } {
  const pct = Math.max(0, Math.min(100, aliquotaPercentuale));
  let gettito = 0;
  const edificiNext = edifici.map((edificio) => {
    if (!isEdificioImpresa(edificio) || edificio.nome === "Bosco" || edificio.nome === "Miniera") {
      return edificio;
    }

    const fatturato = getFatturatoMeseImpresa(edificio);
    const dovuto = pct <= 0 || fatturato <= 0 ? 0 : Math.floor((fatturato * pct) / 100);
    let ed: Edificio = { ...edificio, fatturatoMeseMonete: 0 };
    if (dovuto > 0) {
      const { edificio: ed2, pagato } = provaPagaDaCassa(ed, dovuto);
      ed = ed2;
      gettito += pagato;
    }
    return ed;
  });

  return {
    edifici: edificiNext,
    moneteGiocatore: Math.max(0, Math.floor(moneteGiocatore)) + gettito,
    gettito
  };
}
