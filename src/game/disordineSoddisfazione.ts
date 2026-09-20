import type { Abitante, Edificio } from "../types";
import {
  azioneProbabileSeOstile,
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


export type RisultatoSabotaggioOstile = {
  edifici: Edificio[];
  sabotatoreId: number | null;
  edificioId: number | null;
  messaggio: string | null;
};

/**
 * Recupera il vandalismo storico come conseguenza individuale degli Ostili
 * predisposti al sabotaggio. Al massimo un edificio per cambio mese:
 * -8 efficienza, minimo 40. Castello e Residenze non sono bersagli.
 */
export function applicaSabotaggioOstileMensile(
  abitanti: Abitante[],
  edifici: Edificio[],
  giornoGioco: number,
  mese: number,
  anno: number,
  rng: () => number = Math.random
): RisultatoSabotaggioOstile {
  const candidati = abitanti.filter((abitante) => {
    if (abitante.id === 1 || abitante.razza === "Golem") return false;
    const punti = calcolaPunteggioSoddisfazione(
      abitante,
      edifici,
      giornoGioco,
      mese,
      anno
    );
    const fascia = fasciaDaPunteggio(punti);
    return azioneProbabileSeOstile(abitante, fascia) === "sabotaggio";
  });

  const bersagli = edifici.filter(
    (edificio) =>
      edificio.stato === "Operativo" &&
      edificio.nome !== "Castello" &&
      edificio.tipo !== "Residenza"
  );

  if (candidati.length === 0 || bersagli.length === 0) {
    return {
      edifici,
      sabotatoreId: null,
      edificioId: null,
      messaggio: null
    };
  }

  const sabotatore = candidati[Math.floor(rng() * candidati.length)]!;
  const bersaglio = bersagli[Math.floor(rng() * bersagli.length)]!;
  const nuovaEfficienza = Math.max(40, bersaglio.efficienza - 8);
  const aggiornati = edifici.map((edificio) =>
    edificio.id === bersaglio.id
      ? { ...edificio, efficienza: nuovaEfficienza }
      : edificio
  );

  return {
    edifici: aggiornati,
    sabotatoreId: sabotatore.id,
    edificioId: bersaglio.id,
    messaggio:
      `Sabotaggio: ${sabotatore.nome} ha colpito ${bersaglio.nome} ` +
      `(efficienza ${bersaglio.efficienza}→${nuovaEfficienza}).`
  };
}
