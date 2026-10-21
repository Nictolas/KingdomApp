import type { Abitante, Casta } from "../types";
import { LAVORO_GIOCATORE } from "./schiavituCommercio";

export type CastaInfo = {
  nome: Casta;
  emoji: string;
  regole: string[];
};

export const CASTA_CATALOGO: CastaInfo[] = [
  {
    nome: "Schiavo",
    emoji: "⛓️",
    regole: [
      "Può essere comprato o venduto tra gli abitanti e con il giocatore.",
      "Il padrone deve fornirgli il cibo dal proprio inventario.",
      "Un abitante può uccidere il proprio schiavo senza conseguenze legali.",
      "Se uno Schiavo lavora, il denaro che guadagna va al suo padrone."
    ]
  },
  {
    nome: "Servo della gleba",
    emoji: "🌾",
    regole: [
      "Sono gli schiavi del giocatore (proprietà della colonia).",
      "Se è Disoccupato, cerca autonomamente qualsiasi lavoro per cui è idoneo; il Bosco è il ripiego finale.",
      "Se è Disoccupato, il giocatore può assegnarlo manualmente a un posto disponibile (es. Serra, Bar, Ospedale, Tribunale).",
      "Riceve il cibo dalla Mensa pubblica."
    ]
  },
  {
    nome: "Cittadino",
    emoji: "🏘️",
    regole: [
      "Se è Disoccupato, cerca autonomamente un posto negli edifici pubblici con postazioni libere.",
      "Lo stipendio degli edifici pubblici (1 moneta/giorno) viene pagato dal tesoro del giocatore."
    ]
  },
  {
    nome: "Nobile",
    emoji: "👑",
    regole: [
      "Non può essere messo per forza a lavorare in un posto."
    ]
  }
];

/** Restituisce la casta effettiva dell'abitante (campo esplicito o dedotto dai dati esistenti). */
export function getCastaAbitante(abitante: Abitante): Casta {
  const esplicita = abitante.casta ?? abitante.ceto;
  if (esplicita) return esplicita;

  if (abitante.ruoloSchiavitu === "schiavo") {
    return abitante.schiavistaId != null ? "Schiavo" : "Servo della gleba";
  }

  if (
    abitante.id === 1 ||
    abitante.lavoro === LAVORO_GIOCATORE ||
    abitante.ministero != null ||
    (abitante.fazioni ?? []).includes("Élite")
  ) {
    return "Nobile";
  }

  return "Cittadino";
}

export function getEmojiCasta(casta: Casta): string {
  return CASTA_CATALOGO.find((c) => c.nome === casta)?.emoji ?? "🏘️";
}

/** Schiavo o Servo della gleba: non hanno reddito di cittadinanza e possono essere assegnati coattivamente. */
export function isCastaCoercibile(casta: Casta): boolean {
  return casta === "Schiavo" || casta === "Servo della gleba";
}

/** Schiavi e Servi della gleba non hanno inventario personale. */
export function abitanteHaInventarioPersonale(abitante: Abitante): boolean {
  return !isCastaCoercibile(getCastaAbitante(abitante));
}

/** Cittadino o Nobile: non possono essere messi per forza a lavorare. */
export function isCastaLibera(casta: Casta): boolean {
  return casta === "Cittadino" || casta === "Nobile";
}
