import type { Abitante } from "../types";
import { normalizzaAbitanteInventario } from "./inventario";

/** I Robot non consumano cibo biologico. */
export function abitanteDeveConsumareCiboGiornaliero(abitante: Abitante): boolean {
  return abitante.razza !== "Robot";
}

/** Normalizza inventari (senza inventario per schiavi/servi). */
export function normalizzaInventariAbitanti(abitanti: Abitante[], _giornoGioco: number): Abitante[] {
  return abitanti.map(normalizzaAbitanteInventario);
}
