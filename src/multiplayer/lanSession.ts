import {
  createManualSignal,
  encodeWire,
  makeHeartbeat,
  makeHello,
  parseManualSignal,
  parseWire,
  type RtcDescription
} from "./signalingProtocol.ts";

/**
 * Adapter a RTCPeerConnection: implementabile con react-native-webrtc senza
 * importare moduli nativi nel motore/nei test. Il collegamento effettivo
 * richiede una development build Android/iOS compatibile con Expo 57.
 */
export interface P2PDataChannel {
  readyState: string;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export interface P2PPeerConnection {
  iceGatheringState: string;
  localDescription: { type: string; sdp?: string } | null;
  onicegatheringstatechange: (() => void) | null;
  ondatachannel: ((event: { channel: P2PDataChannel }) => void) | null;
  createDataChannel(label: string): P2PDataChannel;
  createOffer(): Promise<RtcDescription>;
  createAnswer(): Promise<RtcDescription>;
  setLocalDescription(description: RtcDescription): Promise<void>;
  setRemoteDescription(description: RtcDescription): Promise<void>;
  close(): void;
}

export type PeerRole = "host" | "guest";
export type ConnectionState = "idle" | "signaling" | "waiting" | "connected" | "disconnected" | "error";
export type ConnectionSnapshot = {
  state: ConnectionState;
  role: PeerRole | null;
  sessionId: string | null;
  otherPeerId: string | null;
  lastPong: number | null;
  error: string | null;
};

export type SessionAdapter = {
  createPeer: () => P2PPeerConnection;
  newId: () => string; // 128 bit casuali generati da RNG crittografico, non Math.random()
  onChange?: (value: ConnectionSnapshot) => void;
  iceTimeoutMs?: number;
};

export class LanP2PSession {
  private peer: P2PPeerConnection | null = null;
  private channel: P2PDataChannel | null = null;
  private peerId: string;
  private snapshot: ConnectionSnapshot = {
    state: "idle", role: null, sessionId: null, otherPeerId: null, lastPong: null, error: null
  };

  constructor(private readonly adapter: SessionAdapter) {
    this.peerId = adapter.newId();
  }

  getSnapshot(): ConnectionSnapshot {
    return { ...this.snapshot };
  }

  private emit(patch: Partial<ConnectionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.adapter.onChange?.(this.getSnapshot());
  }

  private openPeer(): P2PPeerConnection {
    if (this.peer) throw new Error("Chiudi la connessione P2P precedente prima di crearne un'altra.");
    this.peer = this.adapter.createPeer();
    this.peer.ondatachannel = event => this.attachChannel(event.channel);
    return this.peer;
  }

  private attachChannel(channel: P2PDataChannel): void {
    if (this.channel && this.channel !== channel) {
      channel.close();
      return;
    }
    this.channel = channel;
    channel.onopen = () => {
      if (this.snapshot.sessionId) {
        channel.send(encodeWire(makeHello(this.snapshot.sessionId, this.peerId)));
      }
    };
    channel.onclose = () => {
      if (this.snapshot.state !== "disconnected") this.emit({ state: "disconnected" });
    };
    channel.onmessage = event => {
      if (typeof event.data !== "string" || !this.snapshot.sessionId) return;
      try {
        const message = parseWire(event.data, this.snapshot.sessionId);
        if (message.type === "hello") {
          if (message.peerId === this.peerId) throw new Error("Connessione al proprio dispositivo.");
          this.emit({ state: "connected", otherPeerId: message.peerId, error: null });
        } else if (message.type === "ping") {
          channel.send(encodeWire(makeHeartbeat(this.snapshot.sessionId, message.sequence, true)));
        } else if (message.type === "pong") {
          this.emit({ lastPong: message.sequence });
        }
      } catch {
        this.emit({ state: "error", error: "Il peer ha inviato un messaggio di collegamento non valido." });
        this.close();
      }
    };
  }

  private async gatherIce(peer: P2PPeerConnection): Promise<string> {
    if (peer.iceGatheringState !== "complete") {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          peer.onicegatheringstatechange = null;
          reject(new Error("Ricerca dei percorsi WebRTC scaduta: verifica la rete Wi-Fi."));
        }, this.adapter.iceTimeoutMs ?? 30_000);
        peer.onicegatheringstatechange = () => {
          if (peer.iceGatheringState !== "complete") return;
          clearTimeout(timeout);
          peer.onicegatheringstatechange = null;
          resolve();
        };
        if (peer.iceGatheringState === "complete") {
          clearTimeout(timeout);
          peer.onicegatheringstatechange = null;
          resolve();
        }
      });
    }
    const sdp = peer.localDescription?.sdp;
    if (!sdp) throw new Error("Descrizione ICE locale non disponibile.");
    if (!sdp.includes("a=candidate:")) {
      throw new Error("Non sono stati trovati percorsi di rete locali. Connetti i dispositivi alla stessa Wi-Fi.");
    }
    return sdp;
  }

  async host(): Promise<string> {
    if (this.peer) throw new Error("Chiudi la connessione P2P precedente prima di crearne un'altra.");
    const sessionId = this.adapter.newId();
    this.emit({ state: "signaling", role: "host", sessionId, otherPeerId: null, error: null });
    try {
      const peer = this.openPeer();
      this.attachChannel(peer.createDataChannel("mykingdom-lan-v1"));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const sdp = await this.gatherIce(peer);
      this.emit({ state: "waiting" });
      return createManualSignal("offer", sessionId, sdp);
    } catch (cause) {
      this.fail(cause);
      throw cause;
    }
  }

  async join(offerCode: string): Promise<string> {
    if (this.peer) throw new Error("Chiudi la connessione P2P precedente prima di crearne un'altra.");
    const offer = parseManualSignal(offerCode, "offer");
    this.emit({ state: "signaling", role: "guest", sessionId: offer.sessionId, otherPeerId: null, error: null });
    try {
      const peer = this.openPeer();
      await peer.setRemoteDescription(offer.description);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      const sdp = await this.gatherIce(peer);
      this.emit({ state: "waiting" });
      return createManualSignal("answer", offer.sessionId, sdp);
    } catch (cause) {
      this.fail(cause);
      throw cause;
    }
  }

  async acceptAnswer(answerCode: string): Promise<void> {
    if (!this.peer || !this.snapshot.sessionId || this.snapshot.role !== "host" || this.snapshot.state !== "waiting") {
      throw new Error("Crea prima un invito P2P da questo dispositivo.");
    }
    const answer = parseManualSignal(answerCode, "answer", this.snapshot.sessionId);
    try {
      await this.peer.setRemoteDescription(answer.description);
    } catch (cause) {
      this.fail(cause);
      throw cause;
    }
  }

  ping(sequence: number): void {
    if (this.snapshot.state !== "connected" || this.channel?.readyState !== "open" || !this.snapshot.sessionId) {
      throw new Error("Il collegamento P2P non è ancora operativo.");
    }
    this.channel.send(encodeWire(makeHeartbeat(this.snapshot.sessionId, sequence)));
  }

  private fail(cause: unknown): void {
    const message = cause instanceof Error ? cause.message : "Errore di collegamento.";
    this.close();
    this.emit({ state: "error", error: message });
  }

  close(): void {
    if (this.channel) {
      this.channel.onopen = null;
      this.channel.onclose = null;
      this.channel.onmessage = null;
      try { this.channel.close(); } catch { /* Already closed. */ }
      this.channel = null;
    }
    if (this.peer) {
      this.peer.ondatachannel = null;
      this.peer.onicegatheringstatechange = null;
      try { this.peer.close(); } catch { /* Already closed. */ }
      this.peer = null;
    }
    this.emit({ state: "disconnected", otherPeerId: null });
  }
}
