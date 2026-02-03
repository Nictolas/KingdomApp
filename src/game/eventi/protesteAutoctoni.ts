import type { Abitante } from "../../types";
import type { EventoDef } from "./eventoTypes";

export const eventoProtesteAutoctoni: EventoDef = {
  id: "proteste-autoctoni",
  nome: "Proteste degli Autoctoni",
  emoji: "✊",
  descrizione:
    "La popolazione nativa del pianeta manifesta contro l'espansione della colonia. Rischio di tensione sociale e calo di felicità.",
  durataMesi: 2,
  probabilità: 0.25,
  condizione: (abitanti) => {
    if (abitanti.length === 0) return false;
    const felicitàMedia = abitanti.reduce((s, a) => s + a.felicità, 0) / abitanti.length;
    return felicitàMedia < 45;
  },
  applicaAttivazione: () => {},
  applicaMensile: (_r, abitanti) => {
    abitanti.forEach((a) => {
      (a as Abitante).felicità = Math.max(1, (a as Abitante).felicità - 3);
    });
  }
};
