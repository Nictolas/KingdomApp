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
  /** Prezzo (crediti/unità) quando vendiamo noi al pianeta (per compraRisorsaId). */
  prezzoVendita: number;
  /** Prezzo (crediti/unità) quando compriamo noi dal pianeta (per vendiRisorsaId). */
  prezzoAcquisto: number;
};

export const pianetiData: PianetaInfo[] = [
  { id: 1, nome: "Pianeta dei Grigi", emoji: "👽", razza: "Grigi", compraRisorsaId: 7, vendiRisorsaId: 3, prezzoVendita: 9, prezzoAcquisto: 6 },
  { id: 2, nome: "Pianeta dei Nordici", emoji: "🧝", razza: "Nordici", compraRisorsaId: 6, vendiRisorsaId: 4, prezzoVendita: 5, prezzoAcquisto: 10 },
  { id: 3, nome: "Pianeta dei Rettiliani", emoji: "🦎", razza: "Rettiliani", compraRisorsaId: 2, vendiRisorsaId: 8, prezzoVendita: 4, prezzoAcquisto: 9 },
  { id: 4, nome: "Pianeta degli Insettoidi", emoji: "🦟", razza: "Insettoidi", compraRisorsaId: 9, vendiRisorsaId: 2, prezzoVendita: 2, prezzoAcquisto: 4 },
  { id: 5, nome: "Pianeta dei Marini", emoji: "🐙", razza: "Marini", compraRisorsaId: 3, vendiRisorsaId: 5, prezzoVendita: 6, prezzoAcquisto: 5 },
  { id: 6, nome: "Pianeta dei Ferini", emoji: "🐺", razza: "Ferini", compraRisorsaId: 4, vendiRisorsaId: 6, prezzoVendita: 11, prezzoAcquisto: 5 }
];

/** Restituisce l'emoji associata alla razza (es. Rettiliani → 🦎, Robot → 🤖). */
export function getEmojiRazza(razza: Razza): string {
  const p = pianetiData.find((x) => x.razza === razza);
  if (p) return p.emoji;
  if (razza === "Umano") return "👤";
  if (razza === "Robot") return "🤖";
  return "🪐";
}
