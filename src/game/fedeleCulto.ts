/**
 * Regole sui culti (Fedeli = religione Culto del Sole / Culto delle Ombre).
 * Ateo e Deista non possono diventare Fedeli.
 * Religioni create dal giocatore: catalogo custom in partita.
 */

import type { Abitante } from "../types";
import type { ReligioneConCulto } from "./luogoCulto";
import { RELIGIONI_CON_CULTO } from "./luogoCulto";

export const RELIGIONI_BLOCCATE_DA_FEDELE = ["Ateo", "Deista"] as const;

export type ReligioneCanon =
  | "Ateo"
  | "Deista"
  | "Agnostico"
  | "Culto del Sole"
  | "Culto delle Ombre";

/** Religione creata dal giocatore (pagina Religioni → Crea Religione). */
export type ReligioneCustom = {
  id: string;
  nome: string;
  emoji: string;
  descrizione: string;
  /** Aspetto / abiti del Sacerdote per questa religione. */
  aspettoSacerdote?: import("./personaggioAspetto").AspettoPersonaggio;
};

/** Non possono essere Religione del Tempio (Chiesa). */
export const RELIGIONI_ESCLUSE_TEMPIO = ["Ateo", "Deista", "Agnostico"] as const;

/** Default Chiesa: culto organizzato ammesso. */
export const RELIGIONE_TEMPIO_DEFAULT = "Culto del Sole";

export function puòEssereReligioneTempio(
  nome: string,
  custom: readonly ReligioneCustom[] = []
): boolean {
  const n = nome.trim();
  if (!n) return false;
  if ((RELIGIONI_ESCLUSE_TEMPIO as readonly string[]).includes(n)) return false;
  if (èReligioneCanon(n)) return true;
  return custom.some((c) => c.nome === n);
}

/** Religioni selezionabili come Religione del Tempio. */
export function elencoReligioniTempio(custom: readonly ReligioneCustom[] = []): string[] {
  return elencoNomiReligioni(custom).filter((n) => puòEssereReligioneTempio(n, custom));
}

export const EMOJI_RELIGIONE_PRESET = [
  "✨",
  "🕊️",
  "🔥",
  "🌊",
  "🌲",
  "⚡",
  "🌙",
  "📿",
  "🔮",
  "⚖️",
  "🕯️",
  "🌀"
] as const;

export function èReligioneCulto(
  religione: Abitante["religione"] | string | undefined | null
): religione is ReligioneConCulto {
  return (
    religione === "Culto del Sole" || religione === "Culto delle Ombre"
  );
}

/** True se l’abitante è già Fedele di un culto. */
export function èFedeleCulto(abitante: Pick<Abitante, "religione">): boolean {
  return èReligioneCulto(abitante.religione);
}

/**
 * True se può acquisire (o mantenere) la religione di un culto.
 * Ateo e Deista non possono diventare Fedeli.
 */
export function puoDiventareFedeleCulto(
  abitante: Pick<Abitante, "religione">
): boolean {
  return !RELIGIONI_BLOCCATE_DA_FEDELE.includes(
    abitante.religione as (typeof RELIGIONI_BLOCCATE_DA_FEDELE)[number]
  );
}

/** Applica religione culto solo se consentito; altrimenti lascia invariato. */
export function provaAssegnaReligioneCulto(
  abitante: Abitante,
  culto: ReligioneConCulto
): Abitante {
  if (!puoDiventareFedeleCulto(abitante) && !èReligioneCulto(abitante.religione)) {
    return abitante;
  }
  if (abitante.religione === culto) return abitante;
  return { ...abitante, religione: culto };
}

export const RELIGIONI_ELENCO: readonly ReligioneCanon[] = [
  "Ateo",
  "Deista",
  "Agnostico",
  "Culto del Sole",
  "Culto delle Ombre"
] as const;

export function èReligioneCanon(nome: string): nome is ReligioneCanon {
  return (RELIGIONI_ELENCO as readonly string[]).includes(nome);
}

/** Elenco nomi (canoniche + custom) per UI. */
export function elencoNomiReligioni(custom: readonly ReligioneCustom[] = []): string[] {
  const out: string[] = [...RELIGIONI_ELENCO];
  for (const c of custom) {
    if (c.nome.trim() && !out.includes(c.nome)) out.push(c.nome);
  }
  return out;
}

export function trovaReligioneCustom(
  nome: string,
  custom: readonly ReligioneCustom[]
): ReligioneCustom | undefined {
  return custom.find((c) => c.nome === nome);
}

export function emojiReligione(
  religione: string,
  custom: readonly ReligioneCustom[] = []
): string {
  const found = trovaReligioneCustom(religione, custom);
  if (found?.emoji) return found.emoji;
  switch (religione) {
    case "Ateo":
      return "🚫";
    case "Deista":
      return "⛪";
    case "Agnostico":
      return "❓";
    case "Culto del Sole":
      return "☀️";
    case "Culto delle Ombre":
      return "🌑";
    default:
      return "📿";
  }
}

export function descrizioneReligione(
  religione: string,
  custom: readonly ReligioneCustom[] = []
): string {
  const found = trovaReligioneCustom(religione, custom);
  if (found?.descrizione) return found.descrizione;
  switch (religione) {
    case "Deista":
      return "Crede in un creatore senza culto organizzato. Non può diventare Fedele né Religione del Tempio.";
    case "Agnostico":
      return "Sospeso sul divino. Può convertirsi e diventare Fedele di un culto. Non può essere Religione del Tempio.";
    case "Ateo":
      return "Nega le divinità. Non può diventare Fedele né Religione del Tempio.";
    case "Culto del Sole":
      return "Fedeli del Sole. Può essere Religione del Tempio (Chiesa) o avere un Luogo di Culto.";
    case "Culto delle Ombre":
      return "Fedeli delle Ombre. Culto tipicamente non umano. Può essere Religione del Tempio.";
    default:
      return "Religione creata nel regno. Può essere Religione del Tempio (Chiesa).";
  }
}

export function normalizzaNomeReligione(nome: string): string {
  return nome.trim().replace(/\s+/g, " ");
}

/**
 * Crea una definizione religione custom.
 * Restituisce errore in italiano se non valida.
 */
export function provaCreaReligioneCustom(
  input: {
    nome: string;
    emoji?: string;
    descrizione?: string;
    aspettoSacerdote?: import("./personaggioAspetto").AspettoPersonaggio;
  },
  esistenti: readonly ReligioneCustom[],
  nextId: () => string
): { ok: true; religione: ReligioneCustom } | { ok: false; errore: string } {
  const nome = normalizzaNomeReligione(input.nome);
  if (nome.length < 2) {
    return { ok: false, errore: "Il nome deve avere almeno 2 caratteri." };
  }
  if (nome.length > 40) {
    return { ok: false, errore: "Il nome è troppo lungo (max 40)." };
  }
  if (èReligioneCanon(nome) || esistenti.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) {
    return { ok: false, errore: "Esiste già una religione con questo nome." };
  }
  const emoji = (input.emoji?.trim() || "📿").slice(0, 4);
  const descrizione = (input.descrizione?.trim() || "Religione creata nel regno.").slice(0, 160);
  return {
    ok: true,
    religione: {
      id: nextId(),
      nome,
      emoji,
      descrizione,
      ...(input.aspettoSacerdote ? { aspettoSacerdote: input.aspettoSacerdote } : {})
    }
  };
}

export function normalizzaReligioniCustom(raw: unknown): ReligioneCustom[] {
  if (!Array.isArray(raw)) return [];
  const out: ReligioneCustom[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const nome = typeof o.nome === "string" ? normalizzaNomeReligione(o.nome) : "";
    if (nome.length < 2 || èReligioneCanon(nome) || seen.has(nome.toLowerCase())) continue;
    seen.add(nome.toLowerCase());
    const id =
      typeof o.id === "string" && o.id.trim()
        ? o.id.trim()
        : `rel-${nome.toLowerCase().replace(/\s+/g, "-")}`;
    const emoji = typeof o.emoji === "string" && o.emoji.trim() ? o.emoji.trim().slice(0, 4) : "📿";
    const descrizione =
      typeof o.descrizione === "string" && o.descrizione.trim()
        ? o.descrizione.trim().slice(0, 160)
        : "Religione creata nel regno.";
    const aspettoSacerdote =
      o.aspettoSacerdote && typeof o.aspettoSacerdote === "object"
        ? (o.aspettoSacerdote as ReligioneCustom["aspettoSacerdote"])
        : undefined;
    out.push({
      id,
      nome,
      emoji,
      descrizione,
      ...(aspettoSacerdote ? { aspettoSacerdote } : {})
    });
  }
  return out;
}

export { RELIGIONI_CON_CULTO };
