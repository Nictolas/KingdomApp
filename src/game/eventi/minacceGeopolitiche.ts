import type { EventoDef } from "./eventoTypes";
import { modificaRisorsa } from "./eventoTypes";

export const eventoMinacceGeopolitiche: EventoDef = {
  id: "minacce-geopolitiche",
  nome: "Minacce geopolitiche",
  emoji: "🌐",
  descrizione: "Tensioni con altre colonie o entità politiche. Possibili sanzioni.",
  durataMesi: 1,
  probabilità: 0.25,
  condizione: (_a, _r, _e, punteggioSanzioni) => punteggioSanzioni >= 6,
  applicaAttivazione: (risorse) => modificaRisorsa(risorse, "Crediti", -150),
  applicaMensile: () => {}
};
