import type { Edificio } from "../types";

/** Route expo-router per aprire la schermata di un edificio (null = usa modale info). */
export function getRouteForEdificio(edificio: Edificio): string | null {
  switch (edificio.nome) {
    case "Serra":
      return `/serra/${edificio.id}`;
    case "Bar":
      return `/bar/${edificio.id}`;
    case "Centrale Energetica":
      return "/centrale-energetica";
    case "Raffineria Mineraria":
      return "/raffineria-mineraria";
    case "Impianto di Riciclo":
      return "/impianto-riciclo";
    case "Baracca":
    case "Capanna":
    case "Dormitorio":
      return "/residenze";
    case "Scuola":
    case "Asilo":
    case "Scuola Elementare":
    case "Scuola Superiore":
    case "Università":
      return "/scuola";
    case "Ospedale Coloniale":
      return "/ospedale";
    case "Centrale":
      return "/centrale";
    case "Tribunale":
      return "/tribunale";
    case "Centro di Comando":
      return "/ministri";
    case "Dissalatore":
      return "/dissalatore";
    case "Laboratorio di Ricerca":
      return "/laboratorio";
    case "Caserma":
      return "/caserma";
    case "Spazioporto":
      return "/spazioporto";
    case "Ufficio Immigrazione":
      return "/immigrazione";
    case "Mercato":
      return "/mercato";
    case "Mensa Pubblica":
      return `/mensa/${edificio.id}`;
    default:
      return null;
  }
}
