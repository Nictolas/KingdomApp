import type { EventoDef } from "./eventoTypes";
import { modificaTesoro } from "./eventoTypes";

export const eventoMinacceGeopolitiche: EventoDef = {
  id: "minacce-geopolitiche",
  nome: "Minacce geopolitiche",
  emoji: "🌐",
  descrizione: "Tensioni con altri regni o entità politiche. Possibili sanzioni.",
  durataMesi: 1,
  probabilità: 0.25,
  condizione: (_a, _r, _e, punteggioSanzioni) => punteggioSanzioni >= 6,
  applicaAttivazione: (_risorse, _a, _e, ctx) => modificaTesoro(ctx, -150),
  applicaMensile: () => {}
};
