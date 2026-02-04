import type { Abitante } from "../types";

export type PoliticaReligiosa = "ateismo-stato" | "religione-stato" | "liberta-culto";
export type ReligioneStato = "Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto degli Alieni" | null;
export type LeggeDroghe = "vietate" | "legali" | "parziali";

export type CalcolaFelicitàModificataInput = {
  politicaReligiosa: PoliticaReligiosa;
  religioneDiStato: ReligioneStato;
  leggeDroghe: LeggeDroghe;
};

/**
 * Calcola la felicità effettiva di un abitante in base a politica religiosa e legge droghe (1-100).
 */
export function calcolaFelicitàModificataPuro(
  abitante: Abitante,
  { politicaReligiosa, religioneDiStato, leggeDroghe }: CalcolaFelicitàModificataInput
): number {
  let felicitàBase = abitante.felicità;

  if (politicaReligiosa === "ateismo-stato") {
    if (abitante.religione === "Ateo") {
      felicitàBase = Math.min(100, felicitàBase + 10);
    }
  } else if (politicaReligiosa === "liberta-culto") {
    if (abitante.religione === "Deista") {
      felicitàBase = Math.min(100, felicitàBase + 10);
    }
  } else if (politicaReligiosa === "religione-stato" && religioneDiStato) {
    if (abitante.religione === religioneDiStato) {
      felicitàBase = Math.min(100, felicitàBase + 20);
    } else {
      felicitàBase = Math.max(1, felicitàBase - 10);
    }
  }

  if (abitante.fazioni?.includes("Mafia") && leggeDroghe === "vietate") {
    felicitàBase = Math.min(100, felicitàBase + 10);
  }

  return Math.min(Math.max(felicitàBase, 1), 100);
}
