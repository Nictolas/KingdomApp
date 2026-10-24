import type { Abitante } from "../types";

/** Priorità assoluta delle vittime che stanno camminando verso il Castello.
 *  Cambi di luce, giorno o routine di riposo non possono trasformare la
 *  loro destinazione in casa. Non si genera una path fittizia/teletrasporto.
 */
export function preservaViaggiUdienzaDuranteCambioGiorno<T extends { purpose: string }>(
  precedenti: Record<number, T>,
  ordinari: Record<number, T>,
  abitanti: readonly Pick<Abitante, "id" | "salute" | "richiestaRapinaBosco">[]
): Record<number, T> {
  const pendenti = new Set(abitanti.filter(a =>
    a.salute > 0 && a.richiestaRapinaBosco?.stato === "verso_castello"
  ).map(a => a.id));
  const mantenuti: Record<number, T> = {};
  for (const [key, meta] of Object.entries(precedenti)) {
    const id = Number(key);
    if (pendenti.has(id) && meta.purpose === "udienza_banditi") {
      mantenuti[id] = meta;
    }
  }
  return { ...ordinari, ...mantenuti };
}
