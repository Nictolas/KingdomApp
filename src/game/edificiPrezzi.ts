/**
 * Prezzi di costruzione in monete (Tesoro del giocatore).
 * Edifici in questa tabella non consumano Materiale Edile al piazzamento.
 */

import { COSTO_PONTE_MONETE, NOME_PONTE } from "./ponteMappa";

export type FasciaEdificio = 1 | 2 | 3 | 4 | 5;

export type EdificioPrezzoDef = {
  nome: string;
  emoji: string;
  fascia: FasciaEdificio;
  prezzoMonete: number;
};

/** Catalogo prezzi costruibili a monete (ordine per fascia). */
export const EDIFICI_PREZZO_MONETE: EdificioPrezzoDef[] = [
  { nome: "Emporio", emoji: "🧺", fascia: 1, prezzoMonete: 100 },
  { nome: "Falegnameria", emoji: "🪚", fascia: 1, prezzoMonete: 150 },
  { nome: "Conceria", emoji: "🧴", fascia: 1, prezzoMonete: 175 },
  { nome: "Forno", emoji: "🍞", fascia: 1, prezzoMonete: 200 },
  { nome: "Cereria", emoji: "🕯️", fascia: 2, prezzoMonete: 250 },
  { nome: "Sartoria", emoji: "👕", fascia: 2, prezzoMonete: 300 },
  { nome: "Birrificio", emoji: "🍺", fascia: 2, prezzoMonete: 350 },
  { nome: "Taverna", emoji: "🍲", fascia: 2, prezzoMonete: 400 },
  { nome: "Spezieria", emoji: "⚗️", fascia: 3, prezzoMonete: 500 },
  { nome: "Armeria", emoji: "🏹", fascia: 3, prezzoMonete: 600 },
  { nome: "Forgia", emoji: "🔨", fascia: 3, prezzoMonete: 700 },
  { nome: "Zecca", emoji: "🪙", fascia: 3, prezzoMonete: 750 },
  { nome: "Chiesa", emoji: "⛪", fascia: 3, prezzoMonete: 800 },
  { nome: "Lazzaretto", emoji: "🏥", fascia: 4, prezzoMonete: 1000 },
  { nome: "Scriptorium", emoji: "📜", fascia: 4, prezzoMonete: 1100 },
  { nome: "Scuola", emoji: "📚", fascia: 4, prezzoMonete: 1250 },
  { nome: "Laboratorio Magico", emoji: "🧙", fascia: 5, prezzoMonete: 1500 },
  { nome: "Cripta Necromantica", emoji: "☠️", fascia: 5, prezzoMonete: 2000 }
];

/** Costo monete Capanna / Serra (sezione Base; non in fasce catalogo). */
export const COSTO_CAPANNA_MONETE = 50;
export const COSTO_SERRA_MONETE = 100;

const PREZZO_BASE_EXTRA: Record<string, number> = {
  Capanna: COSTO_CAPANNA_MONETE,
  Serra: COSTO_SERRA_MONETE
};

const PREZZO_BY_NOME: Record<string, number> = Object.fromEntries(
  EDIFICI_PREZZO_MONETE.map((e) => [e.nome, e.prezzoMonete])
);

/** Costo in monete al piazzamento (0 = nessun addebito monete). */
export function costoCostruzioneMonete(nome: string): number {
  if (nome === NOME_PONTE) return COSTO_PONTE_MONETE;
  if (nome in PREZZO_BASE_EXTRA) return PREZZO_BASE_EXTRA[nome]!;
  return PREZZO_BY_NOME[nome] ?? 0;
}

/** True se l’edificio si paga in monete (niente Materiale Edile). */
export function edificioSiPagaInMonete(nome: string): boolean {
  return nome in PREZZO_BY_NOME || nome in PREZZO_BASE_EXTRA || nome === NOME_PONTE;
}

/** Nomi per sezione Costruisci, raggruppati per fascia. */
export function sezioniFasciaCostruzione(): { titolo: string; nomi: string[] }[] {
  const byFascia = new Map<FasciaEdificio, string[]>();
  for (const e of EDIFICI_PREZZO_MONETE) {
    const list = byFascia.get(e.fascia) ?? [];
    list.push(e.nome);
    byFascia.set(e.fascia, list);
  }
  return ([1, 2, 3, 4, 5] as FasciaEdificio[])
    .filter((f) => (byFascia.get(f)?.length ?? 0) > 0)
    .map((f) => ({ titolo: `Fascia ${f}`, nomi: byFascia.get(f)! }));
}
