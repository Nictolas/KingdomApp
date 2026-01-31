import React, { createContext, useContext, ReactNode } from "react";
import { useGameState } from "../hooks/useGameState";
import type { Abitante, Risorsa, Edificio, OrdineMercato, EventoInCorso, Razza } from "../types";
import type { EventoDef } from "../game/eventi";

type ScaglioneConfig = {
  min: number;
  max: number;
  percentuale: number;
};

type GameContextType = {
  abitanti: Abitante[];
  risorse: Risorsa[];
  edifici: Edificio[];
  mese: number;
  anno: number;
  isLoading: boolean;
  abitantiProposti: Abitante[];
  tipoTassaReddito: "flat" | "scaglioni";
  flatTaxPercentuale: number;
  scaglioniConfig: ScaglioneConfig[];
  politicaNascite: "figlio-unico" | "incentivi" | "nessuna";
  punteggioSanzioni: number;
  penaDiMorteAttiva: boolean;
  politicaReligiosa: "ateismo-stato" | "religione-stato" | "liberta-culto";
  leggeRazzialeAttiva: boolean;
  razzaCampoLavoro: Razza | null;
  razzaCampoSterminio: Razza | null;
  capoReligiosoSole: number | null;
  capoReligiosoAlieni: number | null;
  religioneDiStato: "Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto degli Alieni" | null;
  etaMinimaLavoro: number;
  leggeDroghe: "vietate" | "legali" | "parziali";
  divietoEspatrioAttivo: boolean;
  tipologieFamigliaAccettate: {
    tradizionale: boolean;
    interrazziale: boolean;
    arcobaleno: boolean;
    monogenitoriale: boolean;
  };
  calcolaFelicitàModificata: (abitante: Abitante) => number;
  setTipoTassaReddito: (tipo: "flat" | "scaglioni") => void;
  setFlatTaxPercentuale: (percentuale: number) => void;
  setScaglioniConfig: (config: ScaglioneConfig[]) => void;
  setPoliticaNascite: (politica: "figlio-unico" | "incentivi" | "nessuna") => void;
  setPenaDiMorteAttiva: (attiva: boolean) => void;
  setPoliticaReligiosa: (politica: "ateismo-stato" | "religione-stato" | "liberta-culto") => void;
  setReligioneDiStato: (religione: "Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto degli Alieni" | null) => void;
  setLeggeRazzialeAttiva: (attiva: boolean) => void;
  setRazzaCampoLavoro: (razza: Razza | null) => void;
  setRazzaCampoSterminio: (razza: Razza | null) => void;
  setCapoReligiosoSole: (id: number | null) => void;
  setCapoReligiosoAlieni: (id: number | null) => void;
  setEtaMinimaLavoro: (eta: number) => void;
  setLeggeDroghe: (legge: "vietate" | "legali" | "parziali") => void;
  setDivietoEspatrioAttivo: (attivo: boolean) => void;
  setTipologieFamigliaAccettate: (tipologie: {
    tradizionale: boolean;
    interrazziale: boolean;
    arcobaleno: boolean;
    monogenitoriale: boolean;
  }) => void;
  avanzaMese: () => Promise<void>;
  assegnaAbitanteAEdificio: (abitanteId: number, edificioId: number) => void;
  rimuoviAbitanteDaEdificio: (abitanteId: number, edificioId: number) => void;
  nominaMinistro: (abitanteId: number, ministero: string) => void;
  rimuoviMinistro: (abitanteId: number) => void;
  calcolaProduzioneConsumo: () => Record<string, number>;
  accettaImmigrante: (abitanteId: number) => void;
  rifiutaImmigrante: (abitanteId: number) => void;
  ordiniMercato: OrdineMercato[];
  aggiungiOrdineMercato: (tipo: "compra" | "vendi", risorsaId: number, quantità: number, prezzoUnitario: number) => boolean;
  rimuoviOrdineMercato: (ordineId: number) => void;
  calcolaDeltaOrdiniMercato: () => Record<string, number>;
  graziaCriminale: (abitanteId: number) => void;
  eventiInCorso: EventoInCorso[];
  eventiCatalogo: EventoDef[];
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const gameState = useGameState();

  return <GameContext.Provider value={gameState}>{children}</GameContext.Provider>;
}

export function useGameContext() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGameContext must be used within a GameProvider");
  }
  return context;
}
