import type { Abitante } from "../types";
import { RESIDENZE_CATALOGO } from "../data/residenzeData";
import {
  abitanteUsaBisogniUmani,
  getBisogniAbitante,
  SOGLIA_BISOGNO_AZIONE
} from "./bisogni";

export type PoliticaReligiosa = "ateismo-stato" | "religione-stato" | "liberta-culto";
export type ReligioneStato = "Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto degli Alieni" | null;
export type LeggeDroghe = "vietate" | "legali" | "parziali";

export type CalcolaFelicitàModificataInput = {
  politicaReligiosa: PoliticaReligiosa;
  religioneDiStato: ReligioneStato;
  leggeDroghe: LeggeDroghe;
  /** Nome edificio residenza (es. "Villetta") per bonus catalogo. */
  nomeResidenza?: string | null;
};

function modificatoreFelicitàDaBisogni(abitante: Abitante): number {
  if (!abitanteUsaBisogniUmani(abitante)) return 0;
  const b = getBisogniAbitante(abitante);
  const media = (b.fame + b.energia + b.divertimento + b.socialita + b.igiene) / 5;
  if (media < 25) return -18;
  if (media < SOGLIA_BISOGNO_AZIONE) return -10;
  if (media < 55) return -4;
  if (media >= 80) return 6;
  if (media >= 70) return 3;
  return 0;
}

/** Bonus da catalogo residenze (`felicità` compresso). */
export function modificatoreFelicitàDaResidenza(nomeResidenza: string | null | undefined): number {
  if (!nomeResidenza) return -3; // senzatetto / senza casa
  const cat = RESIDENZE_CATALOGO.find((r) => r.nome === nomeResidenza);
  if (!cat) return 0;
  return Math.max(-2, Math.min(12, Math.floor(cat.felicità / 12) - 1));
}

/**
 * Felicità effettiva: politica, droghe, bisogni e qualità abitazione (1–100).
 */
export function calcolaFelicitàModificataPuro(
  abitante: Abitante,
  { politicaReligiosa, religioneDiStato, leggeDroghe, nomeResidenza }: CalcolaFelicitàModificataInput
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

  felicitàBase += modificatoreFelicitàDaBisogni(abitante);
  if (abitanteUsaBisogniUmani(abitante)) {
    felicitàBase += modificatoreFelicitàDaResidenza(nomeResidenza);
  }

  return Math.min(Math.max(felicitàBase, 1), 100);
}
