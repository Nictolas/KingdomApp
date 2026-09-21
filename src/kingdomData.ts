/**
 * Barrel: re-esporta tutti i dati da src/data.
 * I dati sono definiti in file separati in src/data/ per mantenere il codice ordinato.
 */
export type { RegnoInfo } from "./data";
export {
  regniData,
  getEmojiRazza,
  abitantiData,
  ministeriDisponibili,
  ministriData,
  fazioniData,
  leggiData,
  risorseData,
  edificiData
} from "./data";
