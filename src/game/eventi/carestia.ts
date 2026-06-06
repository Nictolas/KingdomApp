import type { Abitante, Edificio, Risorsa } from "../../types";
import type { EventoDef } from "./eventoTypes";
import { modificaRisorsa } from "./eventoTypes";

export const eventoCarestia: EventoDef = {
  id: "carestia",
  nome: "Carestia",
  emoji: "🌾",
  descrizione: "Carestia: il popolo non ha abbastanza cibo.",
  durataMesi: 2,
  probabilità: 0.3,
  condizione: (_a, risorse) => {
    const cibo = risorse.find((r) => r.nome.toLowerCase().includes("cibo"));
    return (cibo?.quantità ?? 0) < 150;
  },
  applicaAttivazione: (risorse) => modificaRisorsa(risorse, "Cibo", -50),
  applicaMensile: (risorse, abitanti) => {
    modificaRisorsa(risorse, "Cibo", -30);
    abitanti.forEach((a) => {
      (a as Abitante).peso = Math.max(0, (a as Abitante).peso - 3);
    });
  }
};
