import type { Abitante } from "../../types";
import type { EventoDef } from "./eventoTypes";

export const eventoAttentato: EventoDef = {
  id: "attentato",
  nome: "Attentato",
  emoji: "💥",
  descrizione: "Un attacco terroristico o sabotaggio colpisce infrastrutture o abitanti.",
  durataMesi: 1,
  probabilità: 0.2,
  condizione: (abitanti) =>
    abitanti.filter((a) => (a.reati?.length ?? 0) > 0).length >= 1,
  applicaAttivazione: (_r, abitanti) => {
    const vittime = abitanti.filter((a) => a.peso > 20);
    if (vittime.length > 0) {
      const v = vittime[Math.floor(Math.random() * vittime.length)];
      (v as Abitante).peso = Math.max(0, (v as Abitante).peso - 25);
    }
  },
  applicaMensile: () => {}
};
