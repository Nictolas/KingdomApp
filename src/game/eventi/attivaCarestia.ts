import type { EventoInCorso } from "../../types";
import { eventoCarestia } from "./carestia";

/** Attiva l'evento Carestia se non è già in corso (es. mensa esaurita). */
export function attivaEventoCarestia(
  eventiInCorso: EventoInCorso[],
  mese: number,
  anno: number
): EventoInCorso[] {
  if (eventiInCorso.some((e) => e.id === "carestia")) return eventiInCorso;
  return [
    ...eventiInCorso,
    {
      id: eventoCarestia.id,
      iniziatoMese: mese,
      iniziatoAnno: anno,
      durataMesi: eventoCarestia.durataMesi
    }
  ];
}
