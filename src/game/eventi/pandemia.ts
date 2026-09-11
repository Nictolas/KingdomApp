import type { Abitante } from "../../types";
import type { EventoDef } from "./eventoTypes";
import { modificaRisorsa } from "./eventoTypes";

export const eventoPandemia: EventoDef = {
  id: "pandemia",
  nome: "Pandemia",
  emoji: "🦠",
  descrizione:
    "Un'epidemia si diffonde tra i sudditi. L'ospedale e le medicine sono cruciali.",
  durataMesi: 3,
  probabilità: 0.15,
  condizione: (_a, risorse) => {
    const medicine = risorse.find((r) => r.nome === "Medicine");
    return (medicine?.quantità ?? 0) < 80;
  },
  applicaAttivazione: (risorse) => modificaRisorsa(risorse, "Medicine", -15),
  applicaMensile: (risorse, abitanti) => {
    modificaRisorsa(risorse, "Medicine", -15);
    abitanti.forEach((a) => {
      (a as Abitante).peso = Math.max(0, (a as Abitante).peso - 10);
    });
  }
};
