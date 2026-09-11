import { useEffect, useState, useSyncExternalStore } from "react";

import {

  getOrologioGiocoInPausaSnapshot,

  getOrologioGiocoVelocitaSnapshot,

  msRealiPerMinutoGioco,

  setOrologioGiocoVelocita,

  subscribeOrologioGiocoInPausa,

  subscribeOrologioGiocoVelocita,

  syncOrologioGiocoDaWallClock,

  toggleOrologioGiocoPausa,

  type OrologioVelocita

} from "../game/orologioGiocoSession";



export type UseOrologioGiocoResult = {

  minuti: number;

  inPausa: boolean;

  togglePausa: () => void;

  velocita: OrologioVelocita;

  setVelocita: (v: OrologioVelocita) => void;

};



/** Minuti da mezzanotte [0, 1440); a ×1 avanza di 1 minuto di gioco al secondo reale. */

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

    // Poll più frequente della durata di un minuto di gioco, così l’UI mostra ogni minuto.

    const tickMs = Math.max(50, Math.floor(msRealiPerMinutoGioco(velocita) / 2));

    const id = setInterval(() => {

      setMinuti(syncOrologioGiocoDaWallClock());

    }, tickMs);

    return () => clearInterval(id);

  }, [velocita]);



  return {

    minuti,

    inPausa,

    togglePausa: toggleOrologioGiocoPausa,

    velocita,

    setVelocita: setOrologioGiocoVelocita

  };

}


