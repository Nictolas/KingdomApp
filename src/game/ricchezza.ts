import type { Abitante } from "../types";
import { getMoneteInventarioAbitante } from "./inventario";

export type RicchezzaAbitante = {
  abitante: Abitante;
  crediti: number;
  monete: number;
  totale: number;
};

/** Patrimonio = crediti in colonia + monete nell'inventario personale. */
export function calcolaRicchezzaAbitante(abitante: Abitante): RicchezzaAbitante {
  const crediti = Math.max(0, abitante.crediti ?? 0);
  const monete = getMoneteInventarioAbitante(abitante.inventario);
  return {
    abitante,
    crediti,
    monete,
    totale: crediti + monete
  };
}

export function ordinaAbitantiPerRicchezza(abitanti: Abitante[]): RicchezzaAbitante[] {
  return abitanti
    .map(calcolaRicchezzaAbitante)
    .sort((a, b) => {
      if (b.totale !== a.totale) return b.totale - a.totale;
      if (b.crediti !== a.crediti) return b.crediti - a.crediti;
      return a.abitante.nome.localeCompare(b.abitante.nome, "it");
    });
}
