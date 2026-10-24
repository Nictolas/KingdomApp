import type { LanP2PSession, ConnectionSnapshot } from "./lanSession";

/**
 * Dichiarazione per TypeScript. Metro sceglie nativeTransport.native.ts
 * su Android/iOS e nativeTransport.web.ts sul web.
 * Non inserisce WebRTC nativo nella build web.
 */
export declare function createNativeLanSession(
  onChange: (snapshot: ConnectionSnapshot) => void
): LanP2PSession;
