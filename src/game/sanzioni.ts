import type { Abitante, Razza } from "../types";

export type CalcolaPunteggioSanzioniInput = {
  abitanti: Abitante[];
  penaDiMorteAttiva: boolean;
  razzaCampoLavoro: Razza | null;
  razzaCampoSterminio: Razza | null;
  etaMinimaLavoro: number;
  etaPensionabile: number;
  divietoEspatrioAttivo: boolean;
  iusPrimaeNoctisAttivo: boolean;
};

/** Calcola il punteggio sanzioni (1-10) dato lo stato legale attuale. */
export function calcolaPunteggioSanzioni({
  abitanti,
  penaDiMorteAttiva,
  razzaCampoLavoro,
  razzaCampoSterminio,
  etaMinimaLavoro,
  etaPensionabile,
  divietoEspatrioAttivo,
  iusPrimaeNoctisAttivo
}: CalcolaPunteggioSanzioniInput): number {
  let punteggio = 1; // Punteggio base

  // +1 se ci sono schiavisti o schiavi
  const haSchiavitu = abitanti.some(
    (a) => a.ruoloSchiavitu === "schiavista" || a.ruoloSchiavitu === "schiavo"
  );
  if (haSchiavitu) {
    punteggio += 1;
  }

  // +1 se la pena di morte è attiva
  if (penaDiMorteAttiva) {
    punteggio += 1;
  }

  // +1 se il campo di lavoro è attivo
  if (razzaCampoLavoro !== null) {
    punteggio += 1;
  }

  // +1 se il campo di sterminio è attivo
  if (razzaCampoSterminio !== null) {
    punteggio += 1;
  }

  // +1 se l'età minima sul lavoro è 13 o inferiore
  if (etaMinimaLavoro <= 13) {
    punteggio += 1;
  }

  // Età pensionabile: +1 se 61-70, +2 se 71-80, +3 se 81+
  if (etaPensionabile >= 61 && etaPensionabile <= 70) punteggio += 1;
  else if (etaPensionabile >= 71 && etaPensionabile <= 80) punteggio += 2;
  else if (etaPensionabile >= 81) punteggio += 3;

  // +1 se il divieto di espatrio è attivo
  if (divietoEspatrioAttivo) {
    punteggio += 1;
  }

  // +1 se Ius primae noctis è attivo
  if (iusPrimaeNoctisAttivo) {
    punteggio += 1;
  }

  // Limita tra 1 e 10
  return Math.min(Math.max(punteggio, 1), 10);
}

