import {
  BAR_FOOTPRINT_H,
  BAR_FOOTPRINT_W,
  CAPANNA_FOOTPRINT_H,
  CAPANNA_FOOTPRINT_W,
  DISSALATORE_FOOTPRINT_H,
  DISSALATORE_FOOTPRINT_W,
  DORMITORIO_FOOTPRINT_H,
  DORMITORIO_FOOTPRINT_W,
  MERCATO_FOOTPRINT_H,
  MERCATO_FOOTPRINT_W,
  NEGOZIO_FOOTPRINT_H,
  NEGOZIO_FOOTPRINT_W,
  SERRA_FOOTPRINT_H,
  SERRA_FOOTPRINT_W,
  PORTO_FOOTPRINT_H,
  PORTO_FOOTPRINT_W,
  TRIBUNALE_FOOTPRINT_H,
  TRIBUNALE_FOOTPRINT_W,
  UFFICIO_EDILE_FOOTPRINT_H,
  UFFICIO_EDILE_FOOTPRINT_W,
  UFFICIO_IMMIGRAZIONE_FOOTPRINT_H,
  UFFICIO_IMMIGRAZIONE_FOOTPRINT_W
} from "./mappaLayoutConfig";
import { STRADA_FOOTPRINT_H, STRADA_FOOTPRINT_W } from "./stradaFootprint";

export type MappaCostruzioneFootprint = { w: number; h: number };

/** Footprint costruzioni giocatore, separati dalla logica runtime di piazzamento. */
export const FOOTPRINT_COSTRUZIONE: Record<string, MappaCostruzioneFootprint> = {
  Strada: { w: STRADA_FOOTPRINT_W, h: STRADA_FOOTPRINT_H },
  Serra: { w: SERRA_FOOTPRINT_W, h: SERRA_FOOTPRINT_H },
  "Capanna del Cacciatore": { w: 1, h: 1 },
  "Campo dei Taglialegna": { w: 1, h: 1 },
  "Capanno del Guardaboschi": { w: 1, h: 1 },
  "Erboristeria": { w: 1, h: 1 },
  "Apiario": { w: 1, h: 1 },
  "Vivaio forestale": { w: 1, h: 1 },
  Capanna: { w: CAPANNA_FOOTPRINT_W, h: CAPANNA_FOOTPRINT_H },
  Dormitorio: { w: DORMITORIO_FOOTPRINT_W, h: DORMITORIO_FOOTPRINT_H },
  Bar: { w: BAR_FOOTPRINT_W, h: BAR_FOOTPRINT_H },
  Tribunale: { w: TRIBUNALE_FOOTPRINT_W, h: TRIBUNALE_FOOTPRINT_H },
  "Ufficio Immigrazione": { w: UFFICIO_IMMIGRAZIONE_FOOTPRINT_W, h: UFFICIO_IMMIGRAZIONE_FOOTPRINT_H },
  "Ufficio Edile": { w: UFFICIO_EDILE_FOOTPRINT_W, h: UFFICIO_EDILE_FOOTPRINT_H },
  Mercato: { w: MERCATO_FOOTPRINT_W, h: MERCATO_FOOTPRINT_H },
  Negozio: { w: NEGOZIO_FOOTPRINT_W, h: NEGOZIO_FOOTPRINT_H },
  "Mensa Pubblica": { w: MERCATO_FOOTPRINT_W, h: MERCATO_FOOTPRINT_H },
  Dissalatore: { w: DISSALATORE_FOOTPRINT_W, h: DISSALATORE_FOOTPRINT_H },
  Porto: { w: PORTO_FOOTPRINT_W, h: PORTO_FOOTPRINT_H },
  "Luogo di Culto del Sole": { w: 2, h: 2 },
  "Luogo di Culto delle Ombre": { w: 2, h: 2 },
  Carcere: { w: 2, h: 2 },
  "Campo di Lavoro": { w: 2, h: 2 },
  "Campo di Sterminio": { w: 2, h: 2 }
};
