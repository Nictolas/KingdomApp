import React, { createContext, useContext, ReactNode } from "react";
import { useGameState } from "../hooks/useGameState";
import type { Abitante, Risorsa, Edificio } from "../types";

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
  razzaCampoLavoro: "Umano" | "Alieno" | null;
  razzaCampoSterminio: "Umano" | "Alieno" | null;
  capoReligiosoSole: number | null;
  capoReligiosoAlieni: number | null;
  religioneDiStato: "Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto degli Alieni" | null;
  setTipoTassaReddito: (tipo: "flat" | "scaglioni") => void;
  setFlatTaxPercentuale: (percentuale: number) => void;
  setScaglioniConfig: (config: ScaglioneConfig[]) => void;
  setPoliticaNascite: (politica: "figlio-unico" | "incentivi" | "nessuna") => void;
  setPenaDiMorteAttiva: (attiva: boolean) => void;
  setPoliticaReligiosa: (politica: "ateismo-stato" | "religione-stato" | "liberta-culto") => void;
  setReligioneDiStato: (religione: "Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto degli Alieni" | null) => void;
  setLeggeRazzialeAttiva: (attiva: boolean) => void;
  setRazzaCampoLavoro: (razza: "Umano" | "Alieno" | null) => void;
  setRazzaCampoSterminio: (razza: "Umano" | "Alieno" | null) => void;
  setCapoReligiosoSole: (id: number | null) => void;
  setCapoReligiosoAlieni: (id: number | null) => void;
  avanzaMese: () => Promise<void>;
  assegnaAbitanteAEdificio: (abitanteId: number, edificioId: number) => void;
  rimuoviAbitanteDaEdificio: (abitanteId: number, edificioId: number) => void;
  nominaMinistro: (abitanteId: number, ministero: string) => void;
  rimuoviMinistro: (abitanteId: number) => void;
  calcolaProduzioneConsumo: () => Record<string, number>;
  accettaImmigrante: (abitanteId: number) => void;
  rifiutaImmigrante: (abitanteId: number) => void;
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
