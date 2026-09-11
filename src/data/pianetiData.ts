import type { Razza } from "../types";

/** Risorsa che il pianeta COMPRA da noi (noi vendiamo). Id risorsa in risorseData. */
export type PianetaInfo = {
  id: number;
  nome: string;
  emoji: string;
  razza: Razza;
  /** Id risorsa che il pianeta compra da noi → noi vendiamo questa risorsa al pianeta. */
  compraRisorsaId: number;
  /** Id risorsa che il pianeta vende a noi → noi compriamo questa risorsa dal pianeta. */
  vendiRisorsaId: number;
  /** Prezzo (monete/unità) quando vendiamo noi al pianeta (per compraRisorsaId). */
  prezzoVendita: number;
  /** Prezzo (monete/unità) quando compriamo noi dal pianeta (per vendiRisorsaId). */
  prezzoAcquisto: number;
};

export const pianetiData: PianetaInfo[] = [
  { id: 1, nome: "Regni degli Elfi", emoji: "🧝", razza: "Elfo", compraRisorsaId: 7, vendiRisorsaId: 3, prezzoVendita: 9, prezzoAcquisto: 6 },
  { id: 2, nome: "Clan dei Nani", emoji: "⛏️", razza: "Nano", compraRisorsaId: 6, vendiRisorsaId: 4, prezzoVendita: 5, prezzoAcquisto: 10 },
  { id: 3, nome: "Tribù degli Orchi", emoji: "🪓", razza: "Orco", compraRisorsaId: 2, vendiRisorsaId: 8, prezzoVendita: 4, prezzoAcquisto: 9 },
  { id: 4, nome: "Città dei Goblin", emoji: "👺", razza: "Goblin", compraRisorsaId: 9, vendiRisorsaId: 2, prezzoVendita: 2, prezzoAcquisto: 4 },
  { id: 5, nome: "Custodi di Pietra", emoji: "🗿", razza: "Golem", compraRisorsaId: 3, vendiRisorsaId: 5, prezzoVendita: 6, prezzoAcquisto: 5 }
];

/** Restituisce l'emoji associata al popolo (es. Elfo → 🧝, Golem → 🗿). */
export function getEmojiRazza(razza: Razza): string {
  const p = pianetiData.find((x) => x.razza === razza);
  if (p) return p.emoji;
  if (razza === "Umano") return "👤";
  if (razza === "Golem") return "🗿";
  return "🏰";
}

/** Colore testo UI per la razza (tabelle, schede). */
export function getColoreRazza(razza: Razza | string | null | undefined): string {
  switch (razza) {
    case "Umano":
      return "#93c5fd";
    case "Nano":
      return "#fbbf24";
    case "Elfo":
      return "#86efac";
    case "Orco":
      return "#a3e635";
    case "Goblin":
      return "#4ade80";
    case "Scheletro":
      return "#e2e8f0";
    case "Vampiro":
      return "#f87171";
    case "Lucertoloide":
      return "#2dd4bf";
    case "Golem":
      return "#94a3b8";
    default:
      return "#e5e7eb";
  }
}
