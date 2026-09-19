/**
 * Casta Clero: Sacerdote / Capo Spirituale.
 * Non consumano cibo né usano monete; l’occupazione resta sempre clericale.
 */

import type { Abitante } from "../types";

export const LAVORO_SACERDOTE = "Sacerdote";
/** Titolo alto del clero (ex «Capo Religioso» nei culti). */
export const LAVORO_CAPO_SPIRITUALE = "Capo Spirituale";
/** Alias legacy nei salvataggi / UI culto. */
export const LAVORO_CAPO_RELIGIOSO_LEGACY = "Capo Religioso";

const LAVORI_CLERO = new Set<string>([
  LAVORO_SACERDOTE,
  LAVORO_CAPO_SPIRITUALE,
  LAVORO_CAPO_RELIGIOSO_LEGACY
]);

export function èLavoroClero(lavoro: string): boolean {
  return LAVORI_CLERO.has(lavoro);
}

/** True se il campo casta/ceto è Clero (senza dipendere da getCastaAbitante). */
export function haCastaCleroEsplicita(abitante: Pick<Abitante, "casta" | "ceto">): boolean {
  return (abitante.casta ?? abitante.ceto) === "Clero";
}

/**
 * Occupazione canonica per un Clero: Capo Spirituale se già alto clero, altrimenti Sacerdote.
 */
export function lavoroCleroPerAbitante(abitante: Pick<Abitante, "lavoro">): string {
  if (
    abitante.lavoro === LAVORO_CAPO_SPIRITUALE ||
    abitante.lavoro === LAVORO_CAPO_RELIGIOSO_LEGACY
  ) {
    return LAVORO_CAPO_SPIRITUALE;
  }
  return LAVORO_SACERDOTE;
}

/** Normalizza lavoro legacy «Capo Religioso» → «Capo Spirituale». */
export function normalizzaLavoroClero(lavoro: string): string {
  if (lavoro === LAVORO_CAPO_RELIGIOSO_LEGACY) return LAVORO_CAPO_SPIRITUALE;
  return lavoro;
}

/** Forza lavoro clericale se la casta esplicita è Clero. */
export function assicuraLavoroClero(abitante: Abitante): Abitante {
  if (!haCastaCleroEsplicita(abitante)) {
    if (abitante.lavoro === LAVORO_CAPO_RELIGIOSO_LEGACY) {
      return { ...abitante, lavoro: LAVORO_CAPO_SPIRITUALE };
    }
    return abitante;
  }
  const lavoro = lavoroCleroPerAbitante(abitante);
  if (abitante.lavoro === lavoro) return abitante;
  return { ...abitante, lavoro };
}
