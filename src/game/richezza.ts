import type { Abitante } from "../types";
import { getMoneteInventarioAbitante } from "./inventario";
import { abitanteHaInventarioPersonale } from "./casta";

export type RicchezzaAbitante = {
  abitante: Abitante;
  monete: number;
  totale: number;
};

/** Patrimonio = monete nell'inventario personale (solo abitanti con inventario). */
export function calcolaRicchezzaAbitante(abitante: Abitante): RicchezzaAbitante {
  const monete = abitanteHaInventarioPersonale(abitante)
    ? getMoneteInventarioAbitante(abitante.inventario)
    : 0;
  return { abitante, monete, totale: monete };
}

export function ordinaAbitantiPerRicchezza(abitanti: Abitante[]): RicchezzaAbitante[] {
  return abitanti
    .map(calcolaRicchezzaAbitante)
    .sort((a, b) => b.totale - a.totale || a.abitante.nome.localeCompare(b.abitante.nome, "it"));
}
