import type { Abitante } from "../types";
import { getCastaAbitante } from "./casta";
import { normalizzaAbitanteInventario } from "./inventario";

/** Golem e Clero non consumano cibo. */
export function abitanteDeveConsumareCiboGiornaliero(abitante: Abitante): boolean {
  if (abitante.razza === "Golem") return false;
  if (getCastaAbitante(abitante) === "Clero") return false;
  return true;
}

/** Normalizza inventari (senza inventario per schiavi/servi/clero). */
export function normalizzaInventariAbitanti(abitanti: Abitante[], _giornoGioco: number): Abitante[] {
  return abitanti.map(normalizzaAbitanteInventario);
}
