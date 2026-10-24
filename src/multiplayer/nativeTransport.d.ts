import type { LanP2PSession, ConnectionSnapshot } from "./lanSession";
import type { BarterMessage } from "./barterProtocol";

/**
 * Dichiarazione per TypeScript. Metro sceglie nativeTransport.native.ts
 * su Android/iOS e nativeTransport.web.ts sul web.
 * Non inserisce WebRTC nativo nella build web.
 */
export declare function createNativeLanSession(
  onChange: (snapshot: ConnectionSnapshot) => void,
  onBarterMessage?: (message: BarterMessage) => void
): LanP2PSession;
