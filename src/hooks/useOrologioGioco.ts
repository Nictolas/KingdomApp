import { useEffect, useState } from "react";
import { syncOrologioGiocoDaWallClock } from "../game/orologioGiocoSession";

/** Minuti da mezzanotte [0, 1440), aggiornati ogni secondo reale (1 sec = 1 min in-game). */
export function useOrologioGioco(): number {
  const [minuti, setMinuti] = useState(() => syncOrologioGiocoDaWallClock());
  useEffect(() => {
    const id = setInterval(() => {
      setMinuti(syncOrologioGiocoDaWallClock());
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return minuti;
}
