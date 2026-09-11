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
  /**
   * Profondità del mare (celle dal bordo sud) per ogni colonna.
   * Costa frastagliata: solo sud, niente mare a sinistra/destra/nord.
   */
  costaSudProfondita?: number[];
  /**
   * Versione layout mappa.
   * `3+` = fiume unico, Bosco in due pezzi, sabbia sulle rive; griglia 88×50.
   */
  mappaLayoutVersion?: number;
};
