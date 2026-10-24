import type { TerrenoType } from "./riverGeneration";
import type { CheckpointTurniForestali } from "./forestTurnSave";

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
  /** Profondità del mare dal bordo sud, per colonna. */
  costaSudProfondita?: number[];
  /** Fasi e minuti dei lavoratori forestali: assente nei salvataggi legacy. */
  turniForestaliByAbitanteId?: CheckpointTurniForestali;
};
