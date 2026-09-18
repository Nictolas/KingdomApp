import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getOrologioGiocoInPausaSnapshot,
  getOrologioGiocoVelocitaSnapshot,
  setOrologioGiocoVelocita,
  subscribeOrologioGiocoInPausa,
  subscribeOrologioGiocoVelocita,
  syncOrologioGiocoDaWallClock,
  toggleOrologioGiocoPausa,
  type OrologioGiocoVelocita
} from "../game/orologioGiocoSession";

export type UseOrologioGiocoResult = {
  minuti: number;
  inPausa: boolean;
  velocita: OrologioGiocoVelocita;
  togglePausa: () => void;
  setVelocita: (velocita: OrologioGiocoVelocita) => void;
};

/** Minuti da mezzanotte [0, 1440), aggiornati ogni secondo reale (1 sec = 30 min in-game). */
export function useOrologioGioco(): UseOrologioGiocoResult {
  const [minuti, setMinuti] = useState(() => syncOrologioGiocoDaWallClock());
  const inPausa = useSyncExternalStore(
    subscribeOrologioGiocoInPausa,
    getOrologioGiocoInPausaSnapshot,
    getOrologioGiocoInPausaSnapshot
  );
  const velocita = useSyncExternalStore(
    subscribeOrologioGiocoVelocita,
    getOrologioGiocoVelocitaSnapshot,
    getOrologioGiocoVelocitaSnapshot
  );

  useEffect(() => {
    const id = setInterval(() => {
      setMinuti(syncOrologioGiocoDaWallClock());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return {
    minuti,
    inPausa,
    velocita,
    togglePausa: toggleOrologioGiocoPausa,
    setVelocita: setOrologioGiocoVelocita
  };
}
