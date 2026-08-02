import type { Abitante } from "../types";
import { getMoneteInventarioAbitante } from "./inventario";
import { abitanteHaInventarioPersonale } from "./casta";

export type RicchezzaAbitante = {
  abitante: Abitante;
  monete: number;
  totale: number;
};

/** Patrimonio = monete nell'inventario personale. */
export function calcolaRicchezzaAbitante(abitante: Abitante): RicchezzaAbitante {
  const monete = abitanteHaInventarioPersonale(abitante)
    ? getMoneteInventarioAbitante(abitante.inventario)
    : 0;
  return { abitante, monete, totale: monete };
}

export function ordinaAbitantiPerRicchezza(abitanti: Abitante[]): RicchezzaAbitante[] {
  return abitanti
    .map(calcolaRicchezzaAbitante)
    .sort((a, b) => {
      if (b.totale !== a.totale) return b.totale - a.totale;
      return a.abitante.nome.localeCompare(b.abitante.nome, "it");
    });
}
