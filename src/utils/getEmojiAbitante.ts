import type { Abitante } from "../types";
import { getEmojiRazza } from "../kingdomData";

/** Emoji per umani in base al Lavoro. Se il lavoro non è in mappa si usa l'emoji generica 👤. */
const EMOJI_PER_LAVORO: Record<string, string> = {
  Taglialegna: "🪵",
  Fabbro: "🔨",
  Minatore: "⛏️",
  Agricoltore: "👨‍🌾",
  "Tecnico Agricolo": "👨‍🌾",
  Ricercatore: "👨‍🔬",
  Medico: "👨‍⚕️",
  Insegnante: "👨‍🏫",
  Giudice: "👨‍⚖️",
  Sicurezza: "👮",
  Guardia: "⚔️",
  "Addetta Sicurezza": "👩‍🚒",
  Polizia: "👮",
  Barista: "👨‍🍳",
  Cuoca: "👩‍🍳",
  Cuoco: "👨‍🍳",
  Edile: "👷",
  Muratore: "👷",
  Funzionario: "👨‍💼",
  Commerciante: "👨‍💼",
  Mercante: "🧺",
  Religioso: "🧘",
  Sacerdote: "⛪",
  "Capo Spirituale": "🙏",
  "Capo Religioso": "🙏",
  Esploratore: "🧭",
  Mago: "🧙",
  Alchimista: "⚗️",
  Maestro: "👨‍🏫",
  Falegname: "🪚",
  Conciatore: "🧴",
  Fornaio: "🍞",
  Ceraiolo: "🕯️",
  Sarto: "👕",
  Birraio: "🍺",
  Speziale: "🧪",
  Armaiolo: "🏹",
  Scriba: "📜",
  Oste: "🍲",
  "Medico della Peste": "🏥",
  Necromante: "☠️",
  "Cercatore di Funghi": "🍄",
  "Raccoglitore di Bacche": "🫐",
  Fruttaiolo: "🍎",
  Castagnaro: "🌰",
  Erborista: "🌿",
  "Erborista medico": "🌱",
  Resinaio: "🌲",
  Fioraio: "🌼",
  Apicoltore: "🍯",
  Cacciatore: "🐇",
  "Cacciatore di selvaggina": "🦌",
  Uccellatore: "🪶",
  Scarnificatore: "🦴",
  "Cacciatore di corna": "🦌",
  Pellicciaio: "🐾",
  "Raccoglitore di uova": "🥚",
  "Raccoglitore di semi": "🌾",
  Cavatore: "🪨",
  Prospettore: "💎",
  "Raccoglitore di seta": "🕸️",
  Lumacaro: "🐌",
  Entomologo: "🐛",
  "Raccoglitore di rami": "🌳",
  "Re": "👑",
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
