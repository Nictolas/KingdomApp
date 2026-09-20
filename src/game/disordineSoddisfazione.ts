import type { Abitante, Edificio } from "../types";
import {
  calcolaPunteggioSoddisfazione,
  fasciaDaPunteggio
} from "./soddisfazione";

export type FaseDisordineSoddisfazione = "nessuna" | "protesta" | "ribellione";

export const SOGLIA_PROTESTA_OSTILI = 0.05;
export const SOGLIA_RIBELLIONE_OSTILI = 0.1;

export type SnapshotDisordineSoddisfazione = {
  fase: FaseDisordineSoddisfazione;
  quotaOstili: number;
  numOstili: number;
  popolazione: number;
  avanzata: boolean;
};

export function valutaFaseDisordineSoddisfazione(
  faseCorrente: FaseDisordineSoddisfazione,
  abitanti: Abitante[],
  edifici: Edificio[],
  giornoGioco: number,
  mese: number,
  anno: number
): SnapshotDisordineSoddisfazione {
  const popolazione = abitanti.filter((a) => a.id !== 1 && a.razza !== "Golem").length;
  if (popolazione <= 0) {
    return {
      fase: "nessuna",
      quotaOstili: 0,
      numOstili: 0,
      popolazione: 0,
      avanzata: false
    };
  }

  let numOstili = 0;
  for (const abitante of abitanti) {
    if (abitante.id === 1 || abitante.razza === "Golem") continue;
    const punti = calcolaPunteggioSoddisfazione(
      abitante,
      edifici,
      giornoGioco,
      mese,
      anno
    );
    if (fasciaDaPunteggio(punti) === "Ostile") numOstili += 1;
  }

  const quotaOstili = numOstili / popolazione;
  let fase: FaseDisordineSoddisfazione = "nessuna";

  if (quotaOstili >= SOGLIA_RIBELLIONE_OSTILI) fase = "ribellione";
  else if (quotaOstili >= SOGLIA_PROTESTA_OSTILI) fase = "protesta";

  return {
    fase,
    quotaOstili,
    numOstili,
    popolazione,
    avanzata:
      fase !== "nessuna" &&
      fase !== faseCorrente &&
      !(faseCorrente === "ribellione" && fase === "protesta")
  };
}

export function messaggioFaseDisordineSoddisfazione(
  snapshot: SnapshotDisordineSoddisfazione
): string | null {
  if (!snapshot.avanzata) return null;
  const percentuale = Math.round(snapshot.quotaOstili * 100);

  if (snapshot.fase === "protesta") {
    return `Proteste nel regno: ${snapshot.numOstili} abitanti Ostili (${percentuale}%). Scioperi e tensioni in aumento.`;
  }
  if (snapshot.fase === "ribellione") {
    return `Ribellione! Il ${percentuale}% della popolazione è Ostile. Il regno è in pericolo.`;
  }
  return null;
}
