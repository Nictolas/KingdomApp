import type { Abitante, Edificio } from "../types";
import { idsResidentiFissiCastello, NOME_CASTELLO } from "./castelloGuardie";

/**
 * Il Castello è la residenza del Re, del Consigliere e dei Nobili,
 * anche se nel catalogo il suo tipo è "Amministrazione".
 * Questa normalizzazione ripara anche i salvataggi precedenti.
 */
export function normalizzaResidenzeCastello(
  abitanti: readonly Abitante[],
  edifici: Edificio[]
): Edificio[] {
  const castello = edifici.find((e) => e.nome === NOME_CASTELLO);
  if (!castello) return edifici;
  const fissi = idsResidentiFissiCastello(abitanti);
  const fissiSet = new Set(fissi);
  let changed = false;
  const next = edifici.map((e) => {
    if (e.id === castello.id) {
      const altri = (e.abitantiAssegnati ?? []).filter((id) => !fissiSet.has(id));
      const ids = [...fissi, ...altri];
      if (ids.length === (e.abitantiAssegnati ?? []).length &&
          ids.every((id, i) => id === e.abitantiAssegnati[i]) &&
          e.occupazione === ids.length) return e;
      changed = true;
      return { ...e, abitantiAssegnati: ids, occupazione: ids.length };
    }
    if (e.tipo !== "Residenza") return e;
    const ids = (e.abitantiAssegnati ?? []).filter((id) => !fissiSet.has(id));
    if (ids.length === (e.abitantiAssegnati ?? []).length && e.occupazione === ids.length) return e;
    changed = true;
    return { ...e, abitantiAssegnati: ids, occupazione: ids.length };
  });
  return changed ? next : edifici;
}

/** Elimina le vecchie assegnazioni alle Capanne salvate separatamente sulla mappa. */
export function rimuoviResidentiCastelloDaCaseMappa(
  abitanti: readonly Abitante[],
  residenzeMappa: Record<number, number[]>
): Record<number, number[]> {
  const fissi = new Set(idsResidentiFissiCastello(abitanti));
  let changed = false;
  const next: Record<number, number[]> = {};
  for (const [anchor, ids] of Object.entries(residenzeMappa)) {
    const filtered = ids.filter((id) => !fissi.has(id));
    if (filtered.length !== ids.length) changed = true;
    next[Number(anchor)] = filtered.length === ids.length ? ids : filtered;
  }
  return changed ? next : residenzeMappa;
}
