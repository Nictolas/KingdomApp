import type { Razza } from "../types";

/** Risorsa che il regno COMPRA da noi (noi vendiamo). Id risorsa in risorseData. */
export type RegnoInfo = {
  id: number;
  nome: string;
  emoji: string;
  razza: Razza;
  /** Id risorsa che il regno compra da noi → noi vendiamo questa risorsa al regno. */
  compraRisorsaId: number;
  /** Id risorsa che il regno vende a noi → noi compriamo questa risorsa dal regno. */
  vendiRisorsaId: number;
  /** Prezzo (crediti/unità) quando vendiamo noi al regno (per compraRisorsaId). */
  prezzoVendita: number;
  /** Prezzo (crediti/unità) quando compriamo noi dal regno (per vendiRisorsaId). */
  prezzoAcquisto: number;
};

export const regniData: RegnoInfo[] = [
  { id: 1, nome: "Regni degli Elfi", emoji: "🧝", razza: "Elfo", compraRisorsaId: 7, vendiRisorsaId: 3, prezzoVendita: 9, prezzoAcquisto: 6 },
  { id: 2, nome: "Clan dei Nani", emoji: "⛏️", razza: "Nano", compraRisorsaId: 6, vendiRisorsaId: 4, prezzoVendita: 5, prezzoAcquisto: 10 },
  { id: 3, nome: "Tribù degli Orchi", emoji: "🪓", razza: "Orco", compraRisorsaId: 2, vendiRisorsaId: 8, prezzoVendita: 4, prezzoAcquisto: 9 },
  { id: 4, nome: "Città dei Goblin", emoji: "👺", razza: "Goblin", compraRisorsaId: 9, vendiRisorsaId: 2, prezzoVendita: 2, prezzoAcquisto: 4 },
  { id: 5, nome: "Custodi di Pietra", emoji: "🗿", razza: "Golem", compraRisorsaId: 3, vendiRisorsaId: 5, prezzoVendita: 6, prezzoAcquisto: 5 }
];

/** Restituisce l'emoji associata al popolo (es. Elfo → 🧝, Golem → 🗿). */
export function getEmojiRazza(razza: Razza): string {
  const regno = regniData.find((x) => x.razza === razza);
  if (regno) return regno.emoji;
  if (razza === "Umano") return "👤";
  if (razza === "Golem") return "🗿";
  return "🏰";
}
