import { useSyncExternalStore } from "react";
import {
  getOrologioGiocoInPausaSnapshot,
  subscribeOrologioGiocoInPausa
} from "../game/orologioGiocoSession";

/** True se il tempo di gioco (e la simulazione legata) è in pausa. */
export function useGiocoInPausa(): boolean {
  return useSyncExternalStore(
    subscribeOrologioGiocoInPausa,
    getOrologioGiocoInPausaSnapshot,
    getOrologioGiocoInPausaSnapshot
  );
}
