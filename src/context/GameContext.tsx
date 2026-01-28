import React, { createContext, useContext, ReactNode } from "react";
import { useGameState } from "../hooks/useGameState";
import type { Abitante, Risorsa, Edificio } from "../types";

type GameContextType = {
  abitanti: Abitante[];
  risorse: Risorsa[];
  edifici: Edificio[];
  mese: number;
  anno: number;
  isLoading: boolean;
  avanzaMese: () => Promise<void>;
  assegnaAbitanteAEdificio: (abitanteId: number, edificioId: number) => void;
  rimuoviAbitanteDaEdificio: (abitanteId: number, edificioId: number) => void;
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
