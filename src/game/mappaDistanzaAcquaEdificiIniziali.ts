import type { EdificioInCellaMappa } from "./mappaTypes";
import type { TerrenoType } from "./riverGeneration";
import { getVicini8, isAcqua } from "./mappaGeometry";

/**
 * Solo alla creazione di una partita: riserva una casella di terra fra acqua
 * e ogni edificio iniziale (anche gli angoli e ogni parte dei footprint).
 * Le strade sono infrastrutture e il Bosco è una fascia naturale: esclusi.
 * Non chiamare questo helper nelle azioni di costruzione del giocatore.
 */
export function fasciaTerraEdificiIniziali(
  edifici: Record<number, EdificioInCellaMappa>,
  cols: number,
  rows: number
): Set<number> {
  const fascia = new Set<number>();
  for (const [key, edificio] of Object.entries(edifici)) {
    if (edificio.nome === "Strada" || edificio.nome === "Bosco") continue;
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= cols * rows) continue;
    fascia.add(index);
    for (const vicino of getVicini8(index, cols, rows)) fascia.add(vicino);
  }
  return fascia;
}

/**
 * Rimedio finale per eventuali trasformazioni del terreno durante l'autotiling:
 * nessuna casella del buffer può diventare fiume.
 * Non modifica la costa fissa, né edifici, salvataggi o terreno fuori dal buffer.
 */
export function preservaTerraIntornoEdificiIniziali(
  terreno: Record<number, TerrenoType>,
  fascia: ReadonlySet<number>,
  cols: number,
  rows: number
): void {
  for (const index of fascia) {
    if (!isAcqua(index, cols, rows) && terreno[index] === "river") {
      delete terreno[index];
    }
  }
}
