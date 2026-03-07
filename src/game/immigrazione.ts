import type { Abitante, Razza } from "../types";
import { getEmojiRazza } from "../kingdomData";
import { generaNomeAlieno } from "./nomiAlieni";
import { scegliNomeCognomeUmano } from "./nomiUmani";

export type GeneraImmigratiPropostiResult = {
  nuoviAbitanti: Abitante[];
  nextIdDopo: number;
};

const FAZIONI_RUOLO = ["Amministrazione", "Lavoratori", "Scienziati", "Esploratori"];
const LAVORI = [
  "Tecnico", "Ricercatore", "Ingegnere", "Medico", "Agricoltore",
  "Meccanico", "Esploratore", "Comunicatore", "Sicurezza", "Amministratore"
];
const PERSONALITÀ = [
  "Curioso", "Lavoratore", "Analitico", "Creativo",
  "Pragmatico", "Idealista", "Deciso", "Collaborativo"
];
const RAZZE_IMMIGRATI: Razza[] = ["Umano", "Grigi", "Nordici", "Rettiliani", "Insettoidi", "Marini", "Ferini"];
const EMOJI_UMANI_M: string[] = ["👨", "👨‍🔬", "👨‍💼", "👨‍🔧", "👨‍🌾"];
const EMOJI_UMANI_F: string[] = ["👩", "👩‍🔬", "👩‍💼", "👩‍🔧", "👩‍🌾"];
const RELIGIONI: Abitante["religione"][] = ["Ateo", "Deista", "Agnostico", "Culto del Sole", "Culto degli Alieni"];

/**
 * Genera 0-5 nuovi abitanti proposti per immigrazione (usa Math.random).
 */
export function generaImmigratiProposti(nextId: number): GeneraImmigratiPropostiResult {
  const numNuovi = Math.floor(Math.random() * 6);
  const nuoviAbitanti: Abitante[] = [];

  for (let i = 0; i < numNuovi; i++) {
    const razza = RAZZE_IMMIGRATI[Math.floor(Math.random() * RAZZE_IMMIGRATI.length)];
    const isUmano = razza === "Umano";
    let nome: string;
    let sesso: "M" | "F" | undefined;
    let emoji: string;
    if (isUmano) {
      const { nomeCompleto, sesso: s } = scegliNomeCognomeUmano();
      nome = nomeCompleto;
      sesso = s;
      emoji = s === "M"
        ? EMOJI_UMANI_M[Math.floor(Math.random() * EMOJI_UMANI_M.length)]
        : EMOJI_UMANI_F[Math.floor(Math.random() * EMOJI_UMANI_F.length)];
    } else {
      nome = generaNomeAlieno(razza);
      emoji = getEmojiRazza(razza);
    }
    const fazioniIniziali =
      razza === "Robot"
        ? ["Robots", "Cittadini"]
        : [FAZIONI_RUOLO[Math.floor(Math.random() * FAZIONI_RUOLO.length)], "Immigrati"];

    nuoviAbitanti.push({
      id: nextId + i,
      nome,
      emoji,
      eta: 20 + Math.floor(Math.random() * 50),
      lavoro: LAVORI[Math.floor(Math.random() * LAVORI.length)],
      competenza: 30 + Math.floor(Math.random() * 70),
      produttività: 40 + Math.floor(Math.random() * 60),
      stanchezza: Math.floor(Math.random() * 50),
      personalità: PERSONALITÀ[Math.floor(Math.random() * PERSONALITÀ.length)],
      amici: [],
      rivali: [],
      fazioni: fazioniIniziali,
      peso: 41 + Math.floor(Math.random() * 40),
      salute: 50 + Math.floor(Math.random() * 50),
      crediti: 800 + Math.floor(Math.random() * 401),
      reddito: 100 + Math.floor(Math.random() * 500),
      spese: 50 + Math.floor(Math.random() * 300),
      lealtà: 30 + Math.floor(Math.random() * 50),
      paura: Math.floor(Math.random() * 40),
      felicità: 40 + Math.floor(Math.random() * 50),
      religione: RELIGIONI[Math.floor(Math.random() * RELIGIONI.length)],
      razza,
      specie: isUmano ? "umano" : "alieno",
      ...(sesso != null && { sesso })
    });
  }

  return { nuoviAbitanti, nextIdDopo: nextId + numNuovi };
}
