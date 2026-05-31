import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getOrologioGiocoInPausaSnapshot,
  subscribeOrologioGiocoInPausa,
  syncOrologioGiocoDaWallClock,
  toggleOrologioGiocoPausa
} from "../game/orologioGiocoSession";

export type UseOrologioGiocoResult = {
  minuti: number;
  inPausa: boolean;
  togglePausa: () => void;
};

/** Minuti da mezzanotte [0, 1440), aggiornati ogni secondo reale (1 sec = 30 min in-game). */
export function useOrologioGioco(): UseOrologioGiocoResult {
  const [minuti, setMinuti] = useState(() => syncOrologioGiocoDaWallClock());
  const inPausa = useSyncExternalStore(
    subscribeOrologioGiocoInPausa,
    getOrologioGiocoInPausaSnapshot,
    getOrologioGiocoInPausaSnapshot
  );

  useEffect(() => {
    const id = setInterval(() => {
      setMinuti(syncOrologioGiocoDaWallClock());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return { minuti, inPausa, togglePausa: toggleOrologioGiocoPausa };
}
