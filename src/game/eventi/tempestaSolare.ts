import type { EventoDef } from "./eventoTypes";
import { modificaRisorsa } from "./eventoTypes";

export const eventoTempestaSolare: EventoDef = {
  id: "tempesta-solare",
  nome: "Tempesta Solare",
  emoji: "☀️",
  descrizione: "Una tempesta solare danneggia i sistemi e la produzione di energia.",
  durataMesi: 1,
  probabilità: 0.05,
  condizione: () => true,
  applicaAttivazione: (risorse) => modificaRisorsa(risorse, "Energia", -30),
  applicaMensile: () => {}
};
