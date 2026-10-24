import type { LanP2PSession, ConnectionSnapshot } from "./lanSession";

/** My Kingdom P2P è destinato a dispositivi Android e iPhone. */
export function createNativeLanSession(_onChange: (snapshot: ConnectionSnapshot) => void): LanP2PSession {
  throw new Error("La connessione multiplayer è disponibile soltanto nell'app Android o iPhone.");
}
