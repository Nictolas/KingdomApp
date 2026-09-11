/**
 * Per ogni edificio che accetta lavoratori: competenza minima (0-100, Competenza Generale)
 * e nome della competenza da mostrare (da /competenze).
 * Usato per auto-assign a fine mese e per la UI su /edifici.
 */
export type CompetenzaEdificio = {
  competenzaMinima: number;
  nomeCompetenza: string;
};

export const EDIFICIO_COMPETENZA_RICHIESTA: Record<number, CompetenzaEdificio> = {
  1: { competenzaMinima: 20, nomeCompetenza: "Competenza Generale" },           // Castello (Guardie)
  2: { competenzaMinima: 25, nomeCompetenza: "Competenza Agricola" },           // Serra
  21: { competenzaMinima: 25, nomeCompetenza: "Competenza Agricola" },          // Serra (seconda unità)
  // Miniera (id 3): come Bosco, senza competenza — assunzione libera da mappa
  5: { competenzaMinima: 50, nomeCompetenza: "Competenza Scientifica" },       // Laboratorio di Ricerca
  7: { competenzaMinima: 40, nomeCompetenza: "Competenza Medica" },             // Ospedale
  11: { competenzaMinima: 35, nomeCompetenza: "Competenza Educativa" },        // Scuola
  12: { competenzaMinima: 45, nomeCompetenza: "Competenza Giuridica" },         // Tribunale
  13: { competenzaMinima: 25, nomeCompetenza: "Competenza Tecnica" },            // Impianto di Riciclo
  15: { competenzaMinima: 25, nomeCompetenza: "Competenza Tecnica" },           // Acquedotto
  16: { competenzaMinima: 30, nomeCompetenza: "Competenza Generale" },          // Caserma
  17: { competenzaMinima: 20, nomeCompetenza: "Competenza Generale" },           // Bar
  18: { competenzaMinima: 30, nomeCompetenza: "Competenza Generale" },          // Centrale (polizia)
  22: { competenzaMinima: 35, nomeCompetenza: "Competenza Generale" },           // Ufficio Immigrazione
  23: { competenzaMinima: 20, nomeCompetenza: "Competenza Generale" },           // Mercato
  24: { competenzaMinima: 25, nomeCompetenza: "Competenza Educativa" },          // Asilo
  25: { competenzaMinima: 35, nomeCompetenza: "Competenza Educativa" },          // Scuola Elementare
  26: { competenzaMinima: 40, nomeCompetenza: "Competenza Educativa" },          // Scuola Superiore
  52: { competenzaMinima: 30, nomeCompetenza: "Competenza Tecnica" },            // Zecca
  27: { competenzaMinima: 50, nomeCompetenza: "Competenza Educativa" },          // Università
  28: { competenzaMinima: 20, nomeCompetenza: "Competenza Generale" },            // Negozio
  29: { competenzaMinima: 20, nomeCompetenza: "Competenza Generale" },             // Mensa Pubblica
  30: { competenzaMinima: 0, nomeCompetenza: "Competenza Generale" },            // Luogo di Culto del Sole
  31: { competenzaMinima: 0, nomeCompetenza: "Competenza Generale" },            // Luogo di Culto delle Ombre
  33: { competenzaMinima: 25, nomeCompetenza: "Competenza Tecnica" },            // Ufficio Edile
  34: { competenzaMinima: 30, nomeCompetenza: "Competenza Tecnica" },            // Fucina
  35: { competenzaMinima: 20, nomeCompetenza: "Competenza Generale" },           // Emporio
  36: { competenzaMinima: 25, nomeCompetenza: "Competenza Tecnica" },            // Falegnameria
  37: { competenzaMinima: 25, nomeCompetenza: "Competenza Tecnica" },            // Conceria
  38: { competenzaMinima: 20, nomeCompetenza: "Competenza Generale" },           // Forno
  39: { competenzaMinima: 25, nomeCompetenza: "Competenza Tecnica" },            // Cereria
  40: { competenzaMinima: 25, nomeCompetenza: "Competenza Generale" },           // Sartoria
  41: { competenzaMinima: 25, nomeCompetenza: "Competenza Tecnica" },            // Birrificio
  42: { competenzaMinima: 20, nomeCompetenza: "Competenza Generale" },           // Taverna
  43: { competenzaMinima: 35, nomeCompetenza: "Competenza Scientifica" },        // Spezieria
  44: { competenzaMinima: 35, nomeCompetenza: "Competenza Tecnica" },            // Armeria
  45: { competenzaMinima: 35, nomeCompetenza: "Competenza Tecnica" },            // Forgia
  46: { competenzaMinima: 0, nomeCompetenza: "Competenza Generale" },             // Chiesa
  47: { competenzaMinima: 40, nomeCompetenza: "Competenza Medica" },             // Lazzaretto
  48: { competenzaMinima: 40, nomeCompetenza: "Competenza Educativa" },          // Scriptorium
  49: { competenzaMinima: 55, nomeCompetenza: "Competenza Scientifica" },        // Laboratorio Magico
  50: { competenzaMinima: 60, nomeCompetenza: "Competenza Scientifica" }         // Cripta Necromantica
};
