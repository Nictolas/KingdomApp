/**
 * Per ogni edificio che accetta lavoratori: competenza minima (0-100, Competenza Generale)
 * e nome della competenza da mostrare (da /competenze).
 * Usato per auto-assign Skip Mese e per la UI su /edifici.
 */
export type CompetenzaEdificio = {
  competenzaMinima: number;
  nomeCompetenza: string;
};

export const EDIFICIO_COMPETENZA_RICHIESTA: Record<number, CompetenzaEdificio> = {
  2: { competenzaMinima: 25, nomeCompetenza: "Competenza Agricola" },           // Serra
  3: { competenzaMinima: 35, nomeCompetenza: "Competenza Tecnica" },            // Raffineria Mineraria
  5: { competenzaMinima: 50, nomeCompetenza: "Competenza Scientifica" },       // Laboratorio di Ricerca
  6: { competenzaMinima: 30, nomeCompetenza: "Competenza Tecnica" },            // Centrale Energetica
  7: { competenzaMinima: 40, nomeCompetenza: "Competenza Medica" },             // Ospedale Coloniale
  11: { competenzaMinima: 35, nomeCompetenza: "Competenza Educativa" },        // Scuola
  12: { competenzaMinima: 45, nomeCompetenza: "Competenza Giuridica" },         // Tribunale
  13: { competenzaMinima: 25, nomeCompetenza: "Competenza Tecnica" },            // Impianto di Riciclo
  15: { competenzaMinima: 25, nomeCompetenza: "Competenza Tecnica" },           // Dissalatore
  16: { competenzaMinima: 30, nomeCompetenza: "Competenza Generale" },          // Caserma
  17: { competenzaMinima: 20, nomeCompetenza: "Competenza Generale" },           // Bar
  18: { competenzaMinima: 30, nomeCompetenza: "Competenza Generale" }           // Centrale (polizia)
};
