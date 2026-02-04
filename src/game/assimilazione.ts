import type { Abitante, Razza } from "../types";
import { generaNomeAlieno } from "./nomiAlieni";

export type GeneraAssimilatiInput = {
  razzaNativi: Razza;
  count: number;
  nextId: number;
  emojiNativo: string;
};

export type GeneraAssimilatiResult = {
  nuoviAbitanti: Abitante[];
  nextIdDopo: number;
};

/** Genera gli abitanti nativi assimilati (pura: nessun side effect). */
export function generaAssimilati({
  razzaNativi,
  count,
  nextId,
  emojiNativo
}: GeneraAssimilatiInput): GeneraAssimilatiResult {
  if (count <= 0) {
    return { nuoviAbitanti: [], nextIdDopo: nextId };
  }

  const lavori = ["Tecnico", "Agricoltore", "Meccanico", "Esploratore", "Comunicatore"];
  const personalità = ["Curioso", "Lavoratore", "Pragmatico", "Collaborativo"];
  const religioni: Abitante["religione"][] = ["Ateo", "Deista", "Culto del Sole"];
  const nuoviAbitanti: Abitante[] = [];

  for (let i = 0; i < count; i++) {
    nuoviAbitanti.push({
      id: nextId + i,
      nome: generaNomeAlieno(razzaNativi),
      emoji: emojiNativo,
      eta: 18 + Math.floor(Math.random() * 40),
      lavoro: lavori[Math.floor(Math.random() * lavori.length)],
      competenza: 30 + Math.floor(Math.random() * 50),
      produttività: 50 + Math.floor(Math.random() * 40),
      stanchezza: Math.floor(Math.random() * 40),
      personalità: personalità[Math.floor(Math.random() * personalità.length)],
      amici: [],
      rivali: [],
      fazioni: ["Nativi", "Cittadini"],
      peso: 41 + Math.floor(Math.random() * 40),
      salute: 60 + Math.floor(Math.random() * 35),
      crediti: 800 + Math.floor(Math.random() * 401),
      reddito: 100 + Math.floor(Math.random() * 300),
      spese: 50 + Math.floor(Math.random() * 150),
      lealtà: 40 + Math.floor(Math.random() * 40),
      paura: Math.floor(Math.random() * 30),
      felicità: 50 + Math.floor(Math.random() * 40),
      religione: religioni[Math.floor(Math.random() * religioni.length)],
      razza: razzaNativi,
      specie: "alieno"
    });
  }

  return { nuoviAbitanti, nextIdDopo: nextId + count };
}
