import type { Razza } from "../types";

export type PianetaInfo = { id: number; nome: string; emoji: string; razza: Razza };

export const pianetiData: PianetaInfo[] = [
  { id: 1, nome: "Pianeta dei Grigi", emoji: "👽", razza: "Grigi" },
  { id: 2, nome: "Pianeta dei Nordici", emoji: "🧝", razza: "Nordici" },
  { id: 3, nome: "Pianeta dei Rettiliani", emoji: "🦎", razza: "Rettiliani" },
  { id: 4, nome: "Pianeta degli Insettoidi", emoji: "🦟", razza: "Insettoidi" },
  { id: 5, nome: "Pianeta dei Marini", emoji: "🐙", razza: "Marini" },
  { id: 6, nome: "Pianeta dei Ferini", emoji: "🐺", razza: "Ferini" }
];

/** Restituisce l'emoji associata alla razza (es. Rettiliani → 🦎, Robot → 🤖). */
export function getEmojiRazza(razza: Razza): string {
  const p = pianetiData.find((x) => x.razza === razza);
  if (p) return p.emoji;
  if (razza === "Umano") return "👤";
  if (razza === "Robot") return "🤖";
  return "🪐";
}
