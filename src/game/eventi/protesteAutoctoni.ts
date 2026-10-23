import type { Abitante } from "../../types";
import { aggiungiModificatorePermanente } from "../soddisfazione";
import type { EventoDef } from "./eventoTypes";

export const eventoProtesteAutoctoni: EventoDef = {
  id: "proteste-autoctoni",
  nome: "Proteste degli Autoctoni",
  emoji: "✊",
  descrizione:
    "La popolazione autoctona manifesta contro l'espansione del regno. Rischio di tensione sociale e calo di soddisfazione.",
  durataMesi: 2,
  probabilità: 0.25,
  condizione: (abitanti, _r, _e, _s, _d, soddisfazioneEffettiva) => {
    const conFelicità = abitanti.filter((a) => a.razza !== "Golem");
    if (conFelicità.length === 0) return false;
    const felicitàMedia = conFelicità.reduce((s, a) => s + (soddisfazioneEffettiva?.(a) ?? (50 + (a.modificatoriSoddisfazione ?? []).reduce((tot, m) => tot + m.delta, 0) * 10)), 0) / conFelicità.length;
    return felicitàMedia < 45;
  },
  applicaAttivazione: () => {},
  applicaMensile: (_r, abitanti) => {
    abitanti.forEach((a, i) => {
      if (a.razza === "Golem") return;
      abitanti[i] = aggiungiModificatorePermanente(a, "proteste_autoctoni", -1, "Tensioni e proteste");
    });
  }
};
