import * as Crypto from "expo-crypto";
import { LanP2PSession, type ConnectionSnapshot, type P2PPeerConnection } from "./lanSession";

/**
 * WebRTC nativo di Android/iOS. Richiede una development/native build:
 * Expo Go NON include il modulo react-native-webrtc.
 * Solo candidati host/LAN: nessun server STUN, TURN o signaling.
 */
export function createNativeLanSession(onChange: (snapshot: ConnectionSnapshot) => void): LanP2PSession {
  const { RTCPeerConnection } = require("react-native-webrtc") as typeof import("react-native-webrtc");
  if (typeof RTCPeerConnection !== "function") throw new Error("WebRTC non presente nella build nativa: aggiorna l\u0027app.");
  return new LanP2PSession({
    createPeer: () =>
      new RTCPeerConnection({
        iceServers: []
      }) as unknown as P2PPeerConnection,
    newId: () => Array.from(Crypto.getRandomBytes(16), byte => byte.toString(16).padStart(2, "0")).join(""),
    onChange,
    iceTimeoutMs: 30_000
  });
}
