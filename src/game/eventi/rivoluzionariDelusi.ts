import type { Abitante } from "../../types";
import type { EventoDef } from "./eventoTypes";

export const eventoRivoluzionariDelusi: EventoDef = {
  id: "rivoluzionari-delusi",
  nome: "Rivoluzionari delusi",
  emoji: "🔴",
  descrizione:
    "I Rivoluzionari sono scontenti delle tue scelte (es. grazia all'Ex Sovrano). Tensione e calo di lealtà tra i tuoi ex alleati.",
  durataMesi: 2,
  probabilità: 0.6,
  condizione: (_abitanti, _risorse, _edifici, _punteggioSanzioni, _divietoEspatrio, _calcolaFelicità, soddisfazioneFazioni) => {
    const sodd = soddisfazioneFazioni?.["Rivoluzionari"];
    return sodd != null && sodd < 70;
  },
  applicaAttivazione: () => {},
  applicaMensile: (_r, abitanti) => {
    abitanti.forEach((a) => {
      if (a.fazioni?.includes("Rivoluzionari")) {
        (a as Abitante).lealtà = Math.max(0, (a as Abitante).lealtà - 5);
        (a as Abitante).felicità = Math.max(1, (a as Abitante).felicità - 3);
      }
    });
  }
};
