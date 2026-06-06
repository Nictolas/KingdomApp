import type { Abitante, Specializzazione } from "../types";

export const SPECIALIZZAZIONI: Specializzazione[] = ["Legge", "Medicina", "Educazione", "Agraria"];

const EMOJI: Record<Specializzazione, string> = {
  Legge: "⚖️",
  Medicina: "🏥",
  Educazione: "📚",
  Agraria: "🌾"
};

export function specializzazioneCasuale(): Specializzazione {
  return SPECIALIZZAZIONI[Math.floor(Math.random() * SPECIALIZZAZIONI.length)]!;
}

function inferisciDaLavoro(lavoro: string): Specializzazione | null {
  const l = lavoro.toLowerCase();
  if (l.includes("giudice") || l.includes("avvocat") || l.includes("tribunale")) return "Legge";
  if (l.includes("medic") || l.includes("dottor") || l.includes("inferm") || l.includes("ospedale")) {
    return "Medicina";
  }
  if (l.includes("insegn") || l.includes("professor") || l.includes("studente") || l.includes("scuola")) {
    return "Educazione";
  }
  if (l.includes("agricol") || l.includes("agricolt") || l.includes("cuoc") || l.includes("serra")) {
    return "Agraria";
  }
  return null;
}

/** Restituisce la specializzazione dell'abitante (campo esplicito, inferenza dal lavoro o default stabile). */
export function getSpecializzazioneAbitante(abitante: Abitante): Specializzazione {
  if (abitante.specializzazione) return abitante.specializzazione;
  const daLavoro = inferisciDaLavoro(abitante.lavoro);
  if (daLavoro) return daLavoro;
  return SPECIALIZZAZIONI[Math.abs(abitante.id) % SPECIALIZZAZIONI.length]!;
}

export function getEmojiSpecializzazione(spec: Specializzazione): string {
  return EMOJI[spec];
}
