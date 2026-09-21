import type { Abitante } from "../../types";
import type { EventoDef } from "./eventoTypes";

export const eventoProtesteAutoctoni: EventoDef = {
  id: "proteste-autoctoni",
  nome: "Proteste degli Autoctoni",
  emoji: "✊",
  descrizione:
    "La popolazione autoctona manifesta contro l'espansione del regno. Rischio di tensione sociale e calo di felicità.",
  durataMesi: 2,
  probabilità: 0.25,
  condizione: (abitanti) => {
    const conFelicità = abitanti.filter((a) => a.razza !== "Golem");
    if (conFelicità.length === 0) return false;
    const felicitàMedia = conFelicità.reduce((s, a) => s + a.felicità, 0) / conFelicità.length;
    return felicitàMedia < 45;
  },
  applicaAttivazione: () => {},
  applicaMensile: (_r, abitanti) => {
    abitanti.forEach((a) => {
      if (a.razza === "Golem") return;
      (a as Abitante).felicità = Math.max(1, (a as Abitante).felicità - 3);
    });
  }
};
