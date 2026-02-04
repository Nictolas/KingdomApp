import type { Abitante, Edificio } from "../types";

/**
 * Calcola i nuovi abitanti dopo la grazia di un criminale:
 * lui e amici +10% lealtà, rivali -10% lealtà, reati azzerati per il graziato.
 */
export function graziaCriminalePuro(
  abitanti: Abitante[],
  abitanteId: number
): Abitante[] {
  const c = abitanti.find((a) => a.id === abitanteId);
  if (!c || !c.reati?.length) return abitanti;

  const idsBonus = new Set<number>([c.id, ...(c.amici ?? []).map((x) => x.id)]);
  const idsMalus = new Set<number>((c.rivali ?? []).map((x) => x.id));

  return abitanti.map((a) => {
    let lealtà = a.lealtà;
    if (idsBonus.has(a.id)) lealtà = Math.min(100, Math.round(a.lealtà * 1.1));
    if (idsMalus.has(a.id)) lealtà = Math.max(0, Math.round(a.lealtà * 0.9));
    const reati = a.id === abitanteId ? [] : a.reati;
    return { ...a, lealtà, reati: reati ?? a.reati };
  });
}

/**
 * Restituisce abitanti ed edifici dopo la rimozione dell'abitante condannato a morte.
 */
export function condannaAMortePuro(
  abitanti: Abitante[],
  edifici: Edificio[],
  abitanteId: number
): { nuoviAbitanti: Abitante[]; nuoviEdifici: Edificio[] } {
  const nuoviAbitanti = abitanti.filter((a) => a.id !== abitanteId);
  const nuoviEdifici = edifici.map((e) => {
    const nuovi = (e.abitantiAssegnati ?? []).filter((id) => id !== abitanteId);
    return nuovi.length !== (e.abitantiAssegnati?.length ?? 0)
      ? { ...e, abitantiAssegnati: nuovi, occupazione: nuovi.length }
      : e;
  });
  return { nuoviAbitanti, nuoviEdifici };
}
