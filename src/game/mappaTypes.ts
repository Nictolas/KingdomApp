import type { TerrenoType } from "./riverGeneration";

/** Edificio piazzato su una cella della mappa (campi usati per residenze e routing). */
export type EdificioInCellaMappa = {
  id: number;
  nome: string;
  emoji: string;
  edificioGlobaleId?: number;
  footprintRef?: number;
  footprint?: { w: number; h: number };
};

export type MappaRuntimeState = {
  edificiInMappa: Record<number, EdificioInCellaMappa>;
  terrenoInMappa: Record<number, TerrenoType>;
  decorazioniInMappa: Record<number, string>;
  residenzeMappa: Record<number, number[]>;
  /** Profondità del mare (celle dal bordo sud) per ogni colonna. */
  costaSudProfondita?: number[];
  /** Versione del layout procedurale della mappa. */
  mappaLayoutVersion?: number;
};
