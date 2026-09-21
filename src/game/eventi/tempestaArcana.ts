import type { EventoDef } from "./eventoTypes";
import { modificaRisorsa } from "./eventoTypes";

export const eventoTempestaArcana: EventoDef = {
  id: "tempesta-arcana",
  nome: "Tempesta Arcana",
  emoji: "🌀",
  descrizione: "Un'ondata di magia instabile disperde parte dell'Energia Magica accumulata nel regno.",
  durataMesi: 1,
  probabilità: 0.05,
  condizione: (_abitanti, risorse) =>
    risorse.some((r) => r.nome === "Energia Magica" && r.quantità > 0),
  applicaAttivazione: (risorse) => modificaRisorsa(risorse, "Energia Magica", -30),
  applicaMensile: () => {}
};
