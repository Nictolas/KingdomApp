/**
 * Registro attività economiche e raccolte: scambi moneta ↔ oggetto
 * (Emporio, Bar, Negozio/Serra, …) e ritrovamenti (Bosco).
 */

import { ID_GIOCATORE } from "./schiavituCommercio";

export const MAX_REGISTRAZIONI_SCAMBI = 200;

/** Luoghi tipici di scambio moneta↔oggetto o raccolta. */
export type LuogoScambio =
    | "Emporio"
    | "Bar"
    | "Serra"
    | "Negozio"
    | "Bosco"
    | string;

export type RegistrazioneScambio = {
  id: string;
  giorno: number;
  minutiDaMezzanotte: number;
  /** Edificio dove avviene lo scambio/raccolta (se noto). */
  luogoEdificioId: number | null;
  luogoNome: LuogoScambio;
  /** Chi dà monete (compratore). null = Regno / tesoro / natura. */
  daId: number | null;
  daNome: string;
  /** Chi riceve monete (venditore) o chi trova l’oggetto in raccolta. */
  aId: number | null;
  aNome: string;
  itemId: string;
  itemNome: string;
  itemEmoji: string;
  prezzoMonete: number;
  /** Default "scambio". "raccolta" = bottino gratuito (es. Bosco). "costruzione" = spesa Tesoro Re. */
  tipo?: "scambio" | "raccolta" | "costruzione";
};

/** Nome in UI: se è il giocatore, antepone «Re». */
export function nomeInRegistrazione(id: number | null, nome: string): string {
  const n = (nome ?? "").trim();
  if (!n) return n;
  if (id !== ID_GIOCATORE) return n;
  if (/^re\b/i.test(n)) return n;
  return `Re ${n}`;
}

/** Legacy Emporio → voce unificata. */
export function migraRegistrazioneEmporioLegacy(r: {
  id: string;
  giorno: number;
  minutiDaMezzanotte: number;
  venditoreId: number;
  venditoreNome: string;
  mercanteId: number;
  mercanteNome: string;
  itemId: string;
  itemNome: string;
  itemEmoji: string;
  prezzoMonete: number;
  emporioId: number;
}): RegistrazioneScambio {
  return {
    id: r.id,
    giorno: r.giorno,
    minutiDaMezzanotte: r.minutiDaMezzanotte,
    luogoEdificioId: r.emporioId,
    luogoNome: "Emporio",
    daId: r.mercanteId,
    daNome: r.mercanteNome,
    aId: r.venditoreId,
    aNome: r.venditoreNome,
    itemId: r.itemId,
    itemNome: r.itemNome,
    itemEmoji: r.itemEmoji,
    prezzoMonete: r.prezzoMonete,
    tipo: "scambio"
  };
}

export function appendRegistrazioneScambio(
  prev: RegistrazioneScambio[] | undefined,
  voce: RegistrazioneScambio
): RegistrazioneScambio[] {
  const next = [...(prev ?? []), voce];
  if (next.length <= MAX_REGISTRAZIONI_SCAMBI) return next;
  return next.slice(next.length - MAX_REGISTRAZIONI_SCAMBI);
}

export function formatRegistrazioneScambio(r: RegistrazioneScambio): string {
  const da = nomeInRegistrazione(r.daId, r.daNome);
  const a = nomeInRegistrazione(r.aId, r.aNome);
  if (r.tipo === "raccolta") {
    const prep = r.luogoNome === "Serra" ? "nella" : "nel";
    return `${a} ha trovato ${r.itemNome} ${prep} ${r.luogoNome}`;
  }
  if (r.tipo === "costruzione") {
    return `${da} ha costruito ${r.itemNome}`;
  }
  return `${da} ha comprato ${r.itemNome} da ${a} nel ${r.luogoNome}`;
}

/** Voce di registrazione per una spesa di costruzione dal Tesoro del Re. */
export function voceRegistrazioneCostruzione(params: {
  reId: number;
  reNome: string;
  itemId: string;
  itemNome: string;
  itemEmoji: string;
  prezzoMonete: number;
}): Omit<RegistrazioneScambio, "id" | "giorno" | "minutiDaMezzanotte"> {
  return {
    tipo: "costruzione",
    luogoEdificioId: null,
    luogoNome: "Costruzione",
    daId: params.reId,
    daNome: params.reNome,
    aId: null,
    aNome: "Cantiere",
    itemId: params.itemId,
    itemNome: params.itemNome,
    itemEmoji: params.itemEmoji,
    prezzoMonete: params.prezzoMonete
  };
}

/** Voce di registrazione per un bottino del Bosco (orologio compilato da registraScambioCommerciale). */
export function voceRegistrazioneRaccoltaBosco(params: {
  abitanteId: number;
  abitanteNome: string;
  boscoId: number;
  itemId: string;
  itemNome: string;
  itemEmoji: string;
  quantità?: number;
}): Omit<RegistrazioneScambio, "id" | "giorno" | "minutiDaMezzanotte"> {
  const q = params.quantità ?? 1;
  return {
    tipo: "raccolta",
    luogoEdificioId: params.boscoId,
    luogoNome: "Bosco",
    daId: null,
    daNome: "Bosco",
    aId: params.abitanteId,
    aNome: params.abitanteNome,
    itemId: params.itemId,
    itemNome: q > 1 ? `${params.itemNome} ×${q}` : params.itemNome,
    itemEmoji: params.itemEmoji,
    prezzoMonete: 0
  };
}

/** Voce di registrazione per un bottino della Miniera. */
export function voceRegistrazioneRaccoltaMiniera(params: {
  abitanteId: number;
  abitanteNome: string;
  minieraId: number;
  itemId: string;
  itemNome: string;
  itemEmoji: string;
  quantità?: number;
}): Omit<RegistrazioneScambio, "id" | "giorno" | "minutiDaMezzanotte"> {
  const q = params.quantità ?? 1;
  return {
    tipo: "raccolta",
    luogoEdificioId: params.minieraId,
    luogoNome: "Miniera",
    daId: null,
    daNome: "Miniera",
    aId: params.abitanteId,
    aNome: params.abitanteNome,
    itemId: params.itemId,
    itemNome: q > 1 ? `${params.itemNome} ×${q}` : params.itemNome,
    itemEmoji: params.itemEmoji,
    prezzoMonete: 0
  };
}

/** Voce di registrazione per il raccolto Serra di un Agricoltore. */
export function voceRegistrazioneRaccoltaSerra(params: {
  abitanteId: number;
  abitanteNome: string;
  serraId: number;
  itemId: string;
  itemNome: string;
  itemEmoji: string;
  quantità?: number;
}): Omit<RegistrazioneScambio, "id" | "giorno" | "minutiDaMezzanotte"> {
  const q = params.quantità ?? 1;
  return {
    tipo: "raccolta",
    luogoEdificioId: params.serraId,
    luogoNome: "Serra",
    daId: null,
    daNome: "Serra",
    aId: params.abitanteId,
    aNome: params.abitanteNome,
    itemId: params.itemId,
    itemNome: q > 1 ? `${params.itemNome} ×${q}` : params.itemNome,
    itemEmoji: params.itemEmoji,
    prezzoMonete: 0
  };
}
