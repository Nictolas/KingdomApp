import type { Abitante } from "../../types";
import { aggiungiModificatorePermanente } from "../soddisfazione";
import type { EventoDef } from "./eventoTypes";

export const eventoRivoluzionariDelusi: EventoDef = {
  id: "rivoluzionari-delusi",
  nome: "Rivoluzionari delusi",
  emoji: "🔴",
  descrizione:
    "I Rivoluzionari sono scontenti delle tue scelte (es. grazia all'Ex Sovrano). Tensione e calo di soddisfazione tra i tuoi ex alleati.",
  durataMesi: 2,
  probabilità: 0.6,
  condizione: (_abitanti, _risorse, _edifici, _punteggioSanzioni, _divietoEspatrio, _calcolaFelicità, soddisfazioneFazioni) => {
    const sodd = soddisfazioneFazioni?.["Rivoluzionari"];
    return sodd != null && sodd < 70;
  },
  applicaAttivazione: () => {},
  applicaMensile: (_r, abitanti) => {
    abitanti.forEach((a, i) => {
      if (a.fazioni?.includes("Rivoluzionari")) {
        abitanti[i] = aggiungiModificatorePermanente(a, "delusione_rivoluzionari", -1, "Delusione dei rivoluzionari");
      }
    });
  }
};
