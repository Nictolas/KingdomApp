import type { Abitante } from "../types";
import {
  consumaUnOggettoCibo,
  normalizzaInventarioAbitante
} from "./inventario";

/** I Robot non consumano cibo biologico dall'inventario personale. */
export function abitanteDeveConsumareCiboGiornaliero(abitante: Abitante): boolean {
  return abitante.razza !== "Robot";
}

/**
 * Per ogni giorno di gioco trascorso dall'ultimo pasto, tenta di consumare 1 oggetto Cibo.
 * Se l'inventario non ha cibo, i giorni successivi non consumano fino al prossimo oggetto.
 */
export function applicaConsumoCiboGiornalieroAbitante(
  abitante: Abitante,
  giornoGioco: number
): Abitante {
  let next: Abitante = {
    ...abitante,
    inventario: normalizzaInventarioAbitante(abitante.inventario)
  };

  if (!abitanteDeveConsumareCiboGiornaliero(next)) {
    return next;
  }

  if (next.ultimoGiornoCiboConsumato == null) {
    return { ...next, ultimoGiornoCiboConsumato: giornoGioco };
  }

  const ultimo = next.ultimoGiornoCiboConsumato;
  if (giornoGioco <= ultimo) return next;

  let inv = next.inventario!;
  let ultimoConsumo = ultimo;

  for (let g = ultimo + 1; g <= giornoGioco; g++) {
    const dopo = consumaUnOggettoCibo(inv);
    if (dopo == null) break;
    inv = dopo;
    ultimoConsumo = g;
  }

  return {
    ...next,
    inventario: inv,
    ultimoGiornoCiboConsumato: ultimoConsumo
  };
}

export function applicaConsumoCiboGiornalieroLista(
  abitanti: Abitante[],
  giornoGioco: number
): Abitante[] {
  return abitanti.map((a) => applicaConsumoCiboGiornalieroAbitante(a, giornoGioco));
}

export function normalizzaInventariAbitanti(abitanti: Abitante[], giornoGioco: number): Abitante[] {
  const conInventario = abitanti.map((a) => ({
    ...a,
    inventario: normalizzaInventarioAbitante(a.inventario)
  }));
  return applicaConsumoCiboGiornalieroLista(conInventario, giornoGioco);
}
