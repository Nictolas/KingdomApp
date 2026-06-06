import type { Abitante } from "../types";
import { getEmojiRazza } from "../kingdomData";

/** Emoji per umani in base al Lavoro. Se il lavoro non è in mappa si usa l'emoji generica 👤. */
const EMOJI_PER_LAVORO: Record<string, string> = {
  Agricoltore: "👨‍🌾",
  "Tecnico Agricolo": "👨‍🌾",
  Scienziato: "👨‍🔬",
  Ricercatore: "👨‍🔬",
  Tecnico: "👨‍🔧",
  Meccanico: "👨‍🔧",
  Ingegnere: "👨‍🔧",
  Operatore: "👨‍🔧",
  Medico: "👨‍⚕️",
  Insegnante: "👨‍🏫",
  Giudice: "👨‍⚖️",
  Sicurezza: "👮",
  "Addetta Sicurezza": "👩‍🚒",
  Polizia: "👮",
  Amministratore: "👨‍💼",
  Barista: "👨‍🍳",
  Cuoca: "👩‍🍳",
  Esploratore: "👨‍🚀",
  "Re": "👑",
  Comunicatore: "👨‍💻",
  "Tecnica Comunicazioni": "👩‍💻",
  Studente: "👨‍🎓",
  Apprendista: "👨‍🔧",
  Tirocinante: "👨‍💼",
  Prigioniero: "⛓️",
  Neonato: "👶",
  Disoccupato: "👤",
};

/**
 * Emoji da mostrare per un abitante: gli alieni hanno sempre l'emoji della propria razza.
 * Gli umani (Razza "Umano") hanno emoji in base al Lavoro (es. Agricoltore → 👨‍🌾, Scienziato/Ricercatore → 👨‍🔬);
 * se il lavoro non è mappato si usa 👤.
 */
export function getEmojiAbitante(abitante: Abitante): string {
  const razza = abitante.razza ?? "Umano";
  if (razza !== "Umano") return getEmojiRazza(razza);
  const lavoro = abitante.lavoro ?? "Disoccupato";
  return EMOJI_PER_LAVORO[lavoro] ?? "👤";
}
