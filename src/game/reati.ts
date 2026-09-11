import type { Reato } from "../types";

/** Reati configurabili nella pagina Reati (anni di carcere). */
export const REATI_PUNIBILI = ["Omicidio", "Furto", "Stupro"] as const;
export type ReatoPunibile = (typeof REATI_PUNIBILI)[number];

export type PenaReatiConfig = Record<ReatoPunibile, number>;

export const PENA_REATI_INIZIALE: PenaReatiConfig = {
  Omicidio: 10,
  Furto: 10,
  Stupro: 10
};

export const REATI_PUNIBILI_INFO: {
  reato: ReatoPunibile;
  emoji: string;
  descrizione: string;
}[] = [
  { reato: "Omicidio", emoji: "🔪", descrizione: "Uccisione intenzionale di un abitante." },
  { reato: "Furto", emoji: "🧤", descrizione: "Sottrazione di beni o monete senza consenso." },
  { reato: "Stupro", emoji: "⛔", descrizione: "Violenza sessuale. Crimine gravissimo." }
];

export function isReatoPunibile(reato: string): reato is ReatoPunibile {
  return (REATI_PUNIBILI as readonly string[]).includes(reato);
}

/** Calcola gli anni totali e segnala il primo reato punibile senza legge (anni = 0). */
export function calcolaAnniCarcereDaReati(
  reati: Reato[] | undefined,
  penaReati: PenaReatiConfig
): { anni: number; reatoSenzaLegge?: ReatoPunibile; nessunReatoPunibile: boolean } {
  const lista = reati ?? [];
  const punibiliPresenti = REATI_PUNIBILI.filter((r) => lista.includes(r));
  if (punibiliPresenti.length === 0) {
    return { anni: 0, nessunReatoPunibile: true };
  }
  let anni = 0;
  for (const r of punibiliPresenti) {
    const anniLegge = penaReati[r];
    if (anniLegge <= 0) {
      return { anni: 0, reatoSenzaLegge: r, nessunReatoPunibile: false };
    }
    const occorrenze = lista.filter((x) => x === r).length;
    anni += anniLegge * occorrenze;
  }
  return { anni, nessunReatoPunibile: false };
}

export function messaggioReatoSenzaLegge(reato: ReatoPunibile): string {
  const articolo =
    reato === "Omicidio" ? "l'Omicidio" : reato === "Furto" ? "il Furto" : "lo Stupro";
  return `Nessuna legge punisce ${articolo}.`;
}
