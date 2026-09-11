import type { Edificio } from "../types";

/** Route expo-router per aprire la schermata di un edificio (null = usa modale info). */
export function getRouteForEdificio(edificio: Edificio): string | null {
  switch (edificio.nome) {
    case "Serra":
    case "Bar":
    case "Fucina":
    case "Emporio":
    case "Bosco":
    case "Miniera":
      return `/impresa/${edificio.id}`;
    case "Zecca":
      return "/zecca";
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
    case "Ospedale":
      return "/ospedale";
    case "Centrale":
      return "/centrale";
    case "Tribunale":
      return "/tribunale";
    case "Castello":
      return "/castello";
    case "Acquedotto":
      return "/";
    case "Laboratorio di Ricerca":
      return "/laboratorio";
    case "Caserma":
      return "/caserma";
    case "Carcere":
      return "/carcere";
    case "Porto":
      return "/porto";
    case "Ufficio Immigrazione":
      return "/immigrazione";
    case "Ufficio Edile":
      return "/ufficio-edile";
    case "Mercato":
      return "/mercato";
    case "Mensa Pubblica":
      return `/mensa/${edificio.id}`;
    case "Chiesa":
      return `/chiesa/${edificio.id}`;
    default:
      return null;
  }
}
