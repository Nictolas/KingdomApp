import type { Abitante, Casta } from "../types";
import { lavoroCleroPerAbitante } from "./clero";
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
      "Se uno Schiavo lavora, il denaro che guadagna va al suo padrone.",
      "Non può licenziarsi: resta al lavoro finché padrone o giocatore non lo rimuovono."
    ]
  },
  {
    nome: "Servo della gleba",
    emoji: "🌾",
    regole: [
      "Sono gli schiavi del giocatore (proprietà del regno).",
      "Quando un posto ha posti di lavoro vacanti, il giocatore può assegnare un Servo della gleba a quel lavoro (es. Serra, Bar, Ospedale, Tribunale).",
      "Riceve il cibo dalla Mensa pubblica.",
      "Non può licenziarsi: resta assegnato finché il giocatore non lo rimuove dal posto."
    ]
  },
  {
    nome: "Cittadino",
    emoji: "🏘️",
    regole: [
      "Se è Disoccupato, cerca autonomamente un posto negli edifici pubblici con postazioni libere.",
      "Può licenziarsi (lasciare il posto di lavoro) di propria iniziativa.",
      "Lo stipendio degli edifici pubblici (1 moneta/giorno) viene pagato dal tesoro del giocatore.",
      "Chi sposa un Nobile diventa Nobile."
    ]
  },
  {
    nome: "Nobile",
    emoji: "👑",
    regole: [
      "Non può essere messo per forza a lavorare in un posto.",
      "Vive nel Castello insieme al Re e al Consigliere.",
      "Chi sposa un Nobile diventa Nobile.",
      "Il Re può cambiare la casta di qualsiasi abitante.",
      "Alcuni immigrati possono arrivare già Nobili.",
      "In Avventura: a inizio partita c’è un cugino Nobile del Re con 2 Schiavi privati."
    ]
  },
  {
    nome: "Clero",
    emoji: "⛪",
    regole: [
      "Occupazione sempre «Sacerdote» o «Capo Spirituale».",
      "Non consuma cibo e non usa denaro (né stipendi né spese).",
      "Il Re può nominare abitanti al Clero."
    ]
  }
];

/** Restituisce la casta effettiva dell'abitante (campo esplicito o dedotto dai dati esistenti). */
export function getCastaAbitante(abitante: Abitante): Casta {
  const esplicita = abitante.casta ?? abitante.ceto;
  if (esplicita === "Clero") return "Clero";
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

/** Clero: esente da cibo e monete (non è coercibile). */
export function isCastaClero(casta: Casta): boolean {
  return casta === "Clero";
}

/** Schiavi, Servi e Clero non gestiscono inventario/monete personali. */
export function abitanteHaInventarioPersonale(abitante: Abitante): boolean {
  const c = getCastaAbitante(abitante);
  return !isCastaCoercibile(c) && !isCastaClero(c);
}

/** Cittadino o Nobile: non possono essere messi per forza a lavorare. */
export function isCastaLibera(casta: Casta): boolean {
  return casta === "Cittadino" || casta === "Nobile";
}

function normalizzaFazioniPerCasta(fazioni: string[] | undefined, casta: Casta): string[] {
  let next = [...(fazioni ?? [])];
  if (isCastaCoercibile(casta)) {
    next = next.filter((f) => f !== "Cittadini");
    if (!next.includes("Schiavi")) next.push("Schiavi");
  } else {
    next = next.filter((f) => f !== "Schiavi");
    if (casta === "Cittadino" && !next.includes("Cittadini")) next.push("Cittadini");
  }
  return next;
}

/**
 * Imposta la casta di un abitante (azione del Re).
 * - Servo della gleba: proprietà del regno (`schiavistaId` assente).
 * - Schiavo: richiede padrone; se manca, diventa Servo della gleba.
 * - Clero: lavoro Sacerdote o Capo Spirituale; niente monete.
 * - Cittadino / Nobile: toglie vincoli di schiavitù.
 * Il Re (id 1) resta sempre Nobile.
 */
export function applicaCastaAbitante(
  abitante: Abitante,
  nuovaCasta: Casta,
  opts?: { schiavistaId?: number | null }
): Abitante {
  if (abitante.id === 1 || abitante.lavoro === LAVORO_GIOCATORE) {
    return {
      ...abitante,
      casta: "Nobile",
      ruoloSchiavitu: undefined,
      schiavistaId: undefined,
      fazioni: normalizzaFazioniPerCasta(abitante.fazioni, "Nobile")
    };
  }

  if (nuovaCasta === "Servo della gleba") {
    return {
      ...abitante,
      casta: "Servo della gleba",
      ruoloSchiavitu: "schiavo",
      schiavistaId: undefined,
      crediti: 0,
      spese: 0,
      fazioni: normalizzaFazioniPerCasta(abitante.fazioni, "Servo della gleba")
    };
  }

  if (nuovaCasta === "Schiavo") {
    const padroneId = opts?.schiavistaId;
    if (padroneId == null) {
      return applicaCastaAbitante(abitante, "Servo della gleba");
    }
    return {
      ...abitante,
      casta: "Schiavo",
      ruoloSchiavitu: "schiavo",
      schiavistaId: padroneId,
      crediti: 0,
      spese: 0,
      fazioni: normalizzaFazioniPerCasta(abitante.fazioni, "Schiavo")
    };
  }

  if (nuovaCasta === "Clero") {
    return {
      ...abitante,
      casta: "Clero",
      lavoro: lavoroCleroPerAbitante(abitante),
      ruoloSchiavitu: undefined,
      schiavistaId: undefined,
      crediti: 0,
      spese: 0,
      fazioni: normalizzaFazioniPerCasta(abitante.fazioni, "Clero")
    };
  }

  return {
    ...abitante,
    casta: nuovaCasta,
    ruoloSchiavitu: undefined,
    schiavistaId: undefined,
    fazioni: normalizzaFazioniPerCasta(abitante.fazioni, nuovaCasta)
  };
}

/** Dopo il matrimonio: se almeno uno è Nobile, anche l’altro lo diventa. */
export function applicaNobiltàDaMatrimonio(a: Abitante, b: Abitante): [Abitante, Abitante] {
  const castaA = getCastaAbitante(a);
  const castaB = getCastaAbitante(b);
  let nextA = a;
  let nextB = b;
  if (castaA === "Nobile" && castaB !== "Nobile") {
    nextB = applicaCastaAbitante(b, "Nobile");
  }
  if (castaB === "Nobile" && castaA !== "Nobile") {
    nextA = applicaCastaAbitante(a, "Nobile");
  }
  return [nextA, nextB];
}
