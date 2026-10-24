import {
  createManualSignal,
  encodeWire,
  makeHeartbeat,
  makeHello,
  parseManualSignal,
  parseWire,
  type RtcDescription
} from "./signalingProtocol.ts";
import {
  BARTER_PROTOCOL,
  encodeBarterWire,
  makeBarterOffer,
  parseBarterWire,
  type BarterLine,
  type BarterMessage,
  type BarterOffer
} from "./barterProtocol.ts";

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
  iceConnectionState?: string;
  oniceconnectionstatechange?: (() => void) | null;
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
  /** Receive a verified proposal/response; never transfers resources. */
  onBarterMessage?: (message: BarterMessage) => void;
  iceTimeoutMs?: number;
};

export class LanP2PSession {
  private peer: P2PPeerConnection | null = null;
  private channel: P2PDataChannel | null = null;
  private peerId: string;
  private pendingPing: number | null = null;
  private outgoingBarters = new Map<string, BarterOffer>();
  private incomingBarters = new Map<string, BarterOffer>();
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
    const activePeer = this.peer;
    this.peer.ondatachannel = event => this.attachChannel(event.channel);
    // Distinguish an actual ICE failure from a peer still exchanging codes.
    // "disconnected" may be temporary during a mobile network transition.
    this.peer.oniceconnectionstatechange = () => {
      if (this.peer === activePeer && activePeer.iceConnectionState === "failed") {
        this.fail(new Error("La connessione diretta WebRTC non è riuscita. Verifica che entrambi i telefoni siano sulla stessa Wi-Fi e che la rete non isoli i dispositivi."));
      }
    };
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
      // The remote peer or Wi-Fi may disappear without a deliberate "Disconnect".
      // Discard stale peer identity and the last successful ping.
      if (this.channel === channel) this.close();
    };
    channel.onmessage = event => {
      if (typeof event.data !== "string" || !this.snapshot.sessionId) return;
      try {
        // Barter negotiation is a distinct protocol from the hello/ping wire.
        // The protocol does NOT permit transfers before a durable commit layer.
        const envelope: unknown = JSON.parse(event.data);
        if (envelope && typeof envelope === "object" && "protocol" in envelope &&
            envelope.protocol === BARTER_PROTOCOL) {
          if (this.snapshot.state !== "connected" || !this.snapshot.otherPeerId) {
            throw new Error("Baratto ricevuto prima del collegamento.");
          }
          const barter = parseBarterWire(event.data);
          if (barter.type === "propose") {
            if (barter.offer.proposerId !== this.snapshot.otherPeerId ||
                barter.offer.responderId !== this.peerId ||
                this.incomingBarters.size >= 32 ||
                this.incomingBarters.has(barter.offer.tradeId)) {
              throw new Error("Proposta P2P non corrispondente al peer.");
            }
            this.incomingBarters.set(barter.offer.tradeId, barter.offer);
          } else {
            if (!this.outgoingBarters.has(barter.tradeId)) {
              throw new Error("Risposta a un baratto non richiesto.");
            }
            this.outgoingBarters.delete(barter.tradeId);
          }
          this.adapter.onBarterMessage?.(barter);
          return;
        }
        const message = parseWire(event.data, this.snapshot.sessionId);
        if (message.type === "hello") {
          if (message.peerId === this.peerId) throw new Error("Connessione al proprio dispositivo.");
          this.emit({ state: "connected", otherPeerId: message.peerId, error: null });
        } else if (message.type === "ping") {
          channel.send(encodeWire(makeHeartbeat(this.snapshot.sessionId, message.sequence, true)));
        } else if (message.type === "pong") {
          // An unsolicited or outdated pong is not evidence of a live link.
          if (message.sequence === this.pendingPing && this.snapshot.state === "connected") {
            this.pendingPing = null;
            this.emit({ lastPong: message.sequence });
          }
        }
      } catch {
        this.close();
        this.emit({ state: "error", error: "Il peer ha inviato un messaggio di collegamento non valido." });
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
    this.pendingPing = sequence;
    this.emit({ lastPong: null });
    try {
      this.channel.send(encodeWire(makeHeartbeat(this.snapshot.sessionId, sequence)));
    } catch (cause) {
      this.pendingPing = null;
      this.close();
      throw cause;
    }
  }

  /** Crea una proposta per il peer collegato. Non invia nulla. */
  private makeOutgoingBarter(gives: BarterLine[], wants: BarterLine[]): BarterOffer {
    if (this.snapshot.state !== "connected" || !this.snapshot.otherPeerId ||
        this.channel?.readyState !== "open") {
      throw new Error("Collega prima l'altro giocatore.");
    }
    if (this.outgoingBarters.size >= 32) throw new Error("Troppe proposte di baratto in attesa.");
    const offer = makeBarterOffer({
      tradeId: this.adapter.newId(), proposerId: this.peerId,
      responderId: this.snapshot.otherPeerId, gives, wants
    });
    if (this.outgoingBarters.has(offer.tradeId)) throw new Error("ID baratto già utilizzato.");
    return offer;
  }

  private transmitOffer(offer: BarterOffer): void {
    if (this.snapshot.state !== "connected" ||
        this.snapshot.otherPeerId !== offer.responderId ||
        this.peerId !== offer.proposerId ||
        this.channel?.readyState !== "open") {
      throw new Error("La connessione P2P è cambiata prima di inviare il baratto.");
    }
    this.outgoingBarters.set(offer.tradeId, offer);
    try {
      this.channel.send(encodeBarterWire({ protocol: BARTER_PROTOCOL, type: "propose", offer }));
    } catch (cause) {
      this.outgoingBarters.delete(offer.tradeId);
      throw cause;
    }
  }

  /** Solo anteprima legacy senza persistenza. Non trasferisce scorte. */
  proposeBarter(gives: BarterLine[], wants: BarterLine[]): BarterOffer {
    const offer = this.makeOutgoingBarter(gives, wants);
    this.transmitOffer(offer);
    return offer;
  }

  /**
   * Prima persiste la proposta nel journal, POI la invia al peer.
   * Se la scrittura fallisce, non trasmette nulla. Nessun trasferimento merci.
   */
  async proposeBarterDurably(
    gives: BarterLine[],
    wants: BarterLine[],
    persist: (offer: BarterOffer) => Promise<void>
  ): Promise<BarterOffer> {
    const offer = this.makeOutgoingBarter(gives, wants);
    await persist(offer);
    this.transmitOffer(offer);
    return offer;
  }


