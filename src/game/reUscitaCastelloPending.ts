/**
 * Uscita dal Castello sulla mappa.
 * - `inizio_partita`: tutti i sudditi escono dal Castello (non da Capanna/altri edifici).
 * - `re`: solo il Re (e corte) quando si sceglie «A giro» a partita in corso.
 */

type Listener = () => void;
export type TipoUscitaCastelloPending = "inizio_partita" | "re";

let pending: TipoUscitaCastelloPending | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) l();
}

export function subscribeReUscitaCastelloPending(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True se c’è un’uscita Castello in attesa (inizio partita o Re a giro). */
export function getReUscitaCastelloPending(): boolean {
  return pending != null;
}

export function getTipoUscitaCastelloPending(): TipoUscitaCastelloPending | null {
  return pending;
}

/** Nuova partita: tutti escono dal Castello. */
export function impostaUscitaCastelloInizioPartita(): void {
  pending = "inizio_partita";
  notify();
}

/** Scelta «A giro» a partita avviata: uscita della corte. */
export function impostaReUscitaCastelloPending(): void {
  if (pending === "inizio_partita") return;
  pending = "re";
  notify();
}

export function azzeraReUscitaCastelloPending(): void {
  if (pending == null) return;
  pending = null;
  notify();
}
