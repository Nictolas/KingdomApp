import type { Abitante, Edificio } from "../types";
import { getCastaAbitante } from "./casta";
import { LAVORO_CONSIGLIERE } from "./consigliere";
import { ID_GIOCATORE, isGiocatore } from "./schiavituCommercio";

export const NOME_CASTELLO = "Castello";
export const LAVORO_GUARDIA = "Guardia";
/** Posti massimi per Guardie nel Castello (oltre a Re, Consigliere e Nobili). */
export const CAPACITA_GUARDIE_CASTELLO = 4;

export function trovaCastelloOperativo(edifici: Edificio[]): Edificio | undefined {
  return edifici.find((e) => e.nome === NOME_CASTELLO && e.stato === "Operativo");
}

/** Id del Consigliere (se presente tra gli abitanti). */
function idConsigliereDaAbitanti(abitanti?: Abitante[]): number | null {
  if (!abitanti) return null;
  return abitanti.find((a) => a.lavoro === LAVORO_CONSIGLIERE && a.id !== ID_GIOCATORE)?.id ?? null;
}

/** True se l’abitante risiede nel Castello per ruolo/casta (non come Guardia). */
export function èResidenteFissoCastello(abitante: Abitante): boolean {
  if (isGiocatore(abitante)) return true;
  if (abitante.lavoro === LAVORO_CONSIGLIERE) return true;
  return getCastaAbitante(abitante) === "Nobile";
}

/** Id di Re, Consigliere e Nobili (residenti fissi del Castello). */
export function idsResidentiFissiCastello(abitanti: readonly Abitante[]): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const a of abitanti) {
    if (!èResidenteFissoCastello(a) || seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a.id);
  }
  // Re sempre in testa se presente.
  out.sort((a, b) => {
    if (a === ID_GIOCATORE) return -1;
    if (b === ID_GIOCATORE) return 1;
    return a - b;
  });
  return out;
}

/** Id delle Guardie assegnate al Castello (escluse Re, Consigliere e Nobili). */
export function idsGuardieNelCastello(
  edificio: Edificio,
  reId: number = ID_GIOCATORE,
  abitanti?: Abitante[]
): number[] {
  if (edificio.nome !== NOME_CASTELLO) return [];
  const fissi = new Set(abitanti ? idsResidentiFissiCastello(abitanti) : [reId]);
  if (!abitanti) {
    const consigliereId = idConsigliereDaAbitanti(abitanti);
    if (consigliereId != null) fissi.add(consigliereId);
  }
  return (edificio.abitantiAssegnati ?? []).filter((id) => !fissi.has(id));
}

/** Quante Guardie (non residenti fissi) sono già assegnate al Castello. */
export function numGuardieNelCastello(
  edificio: Edificio,
  reId: number = ID_GIOCATORE,
  abitanti?: Abitante[]
): number {
  return idsGuardieNelCastello(edificio, reId, abitanti).length;
}

/** Guardie assegnate al Castello, in ordine di assegnazione. */
export function listaGuardieCastello(
  edificio: Edificio,
  abitanti: Abitante[],
  reId: number = ID_GIOCATORE
): Abitante[] {
  return idsGuardieNelCastello(edificio, reId, abitanti)
    .map((id) => abitanti.find((a) => a.id === id))
    .filter((a): a is Abitante => a != null);
}

/** Posti ancora liberi per Guardie nel Castello (tetto 4). */
export function postiLiberiGuardieCastello(
  edificio: Edificio,
  reId: number = ID_GIOCATORE,
  abitanti?: Abitante[]
): number {
  if (edificio.nome !== NOME_CASTELLO || edificio.stato !== "Operativo") return 0;
  return Math.max(0, CAPACITA_GUARDIE_CASTELLO - numGuardieNelCastello(edificio, reId, abitanti));
}

export function castelloHaPostoLiberoPerGuardia(
  edifici: Edificio[],
  abitanti?: Abitante[]
): Edificio | undefined {
  const castello = trovaCastelloOperativo(edifici);
  if (!castello || postiLiberiGuardieCastello(castello, ID_GIOCATORE, abitanti) <= 0) return undefined;
  return castello;
}

/** Disoccupato idoneo a farsi assumere come Guardia nel Castello. */
export function disoccupatoIdoneoPerGuardia(abitante: Abitante): boolean {
  if (isGiocatore(abitante)) return false;
  if (èResidenteFissoCastello(abitante)) return false;
  if (abitante.lavoro !== "Disoccupato") return false;
  if (abitante.razza === "Golem") return false;
  return true;
}

/**
 * Assume un Disoccupato nel Castello → Occupazione Guardia + lista assegnati.
 * `ok: false` se non c’è posto o non è idoneo.
 */
export function assumiDisoccupatoComeGuardia(
  abitanti: Abitante[],
  edifici: Edificio[],
  abitanteId: number
): { abitanti: Abitante[]; edifici: Edificio[]; ok: boolean; castelloId?: number } {
  const ab = abitanti.find((a) => a.id === abitanteId);
  const castello = castelloHaPostoLiberoPerGuardia(edifici, abitanti);
  if (!ab || !castello || !disoccupatoIdoneoPerGuardia(ab)) {
    return { abitanti, edifici, ok: false };
  }
  if ((castello.abitantiAssegnati ?? []).includes(abitanteId)) {
    return { abitanti, edifici, ok: false };
  }

  const edificiNext = edifici.map((e) => {
    if (e.id !== castello.id) return e;
    const ids = [...(e.abitantiAssegnati ?? []), abitanteId];
    return { ...e, abitantiAssegnati: ids, occupazione: ids.length };
  });
  const abitantiNext = abitanti.map((a) =>
    a.id === abitanteId ? { ...a, lavoro: LAVORO_GUARDIA } : a
  );
  return { abitanti: abitantiNext, edifici: edificiNext, ok: true, castelloId: castello.id };
}

/** Nobili residenti nel Castello, escluso il Re (Consigliere incluso solo se Nobile). */
export function listaNobiliNelCastello(
  edificio: Edificio,
  abitanti: readonly Abitante[]
): Abitante[] {
  if (edificio.nome !== NOME_CASTELLO) return [];
  const assegnati = new Set(edificio.abitantiAssegnati ?? []);
  return abitanti.filter(
    (a) =>
      !isGiocatore(a) &&
      getCastaAbitante(a) === "Nobile" &&
      assegnati.has(a.id)
  );
}
