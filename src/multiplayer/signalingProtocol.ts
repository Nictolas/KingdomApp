/**
 * My Kingdom — signaling manuale WebRTC per LAN, senza backend.
 * NON è un token di autenticazione e NON autorizza trasferimenti di risorse.
 * Le offerte contengono informazioni di rete/ICE: condividere soltanto con
 * il giocatore con il quale si intende stabilire una connessione.
 */
export const SIGNAL_PREFIX = "MKP2P1:";
export const SIGNAL_MAX_CHARS = 100_000;
export const SIGNAL_MAX_AGE_MS = 30 * 60 * 1_000;
export const SIGNAL_CLOCK_SKEW_MS = 5 * 60 * 1_000;
export const WIRE_MAX_CHARS = 8_192;
export const SESSION_ID_PATTERN = /^[0-9a-f]{32}$/;

export type SignalKind = "offer" | "answer";
export type RtcDescription = { type: SignalKind; sdp: string };
export type ManualSignal = {
  app: "mykingdom";
  version: 1;
  kind: SignalKind;
  sessionId: string;
  createdAt: number;
  description: RtcDescription;
};

export type WireMessage =
  | { protocol: "mk-p2p-v1"; type: "hello"; sessionId: string; peerId: string }
  | { protocol: "mk-p2p-v1"; type: "ping"; sessionId: string; sequence: number }
  | { protocol: "mk-p2p-v1"; type: "pong"; sessionId: string; sequence: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function assertSessionId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !SESSION_ID_PATTERN.test(value)) {
    throw new Error("Identificativo di sessione P2P non valido.");
  }
}

export function assertSdp(value: unknown, expected: SignalKind): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length < 64 ||
    value.length > 90_000 ||
    !value.startsWith("v=0") ||
    !value.includes("a=ice-ufrag:") ||
    !value.includes("a=ice-pwd:") ||
    !/a=fingerprint:sha-256\s+([0-9a-f]{2}:){31}[0-9a-f]{2}/i.test(value)
  ) {
    throw new Error("Descrizione WebRTC incompleta o non valida.");
  }
  if (expected !== "offer" && expected !== "answer") throw new Error("Tipo di SDP non valido.");
}

function decodeAndValidate(raw: string, now: number): ManualSignal {
  if (!raw.startsWith(SIGNAL_PREFIX) || raw.length > SIGNAL_MAX_CHARS) {
    throw new Error("Codice di collegamento My Kingdom non riconosciuto.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(SIGNAL_PREFIX.length));
  } catch {
    throw new Error("Codice di collegamento danneggiato.");
  }
  if (!isRecord(parsed) || parsed.app !== "mykingdom" || parsed.version !== 1) {
    throw new Error("Versione di collegamento non supportata.");
  }
  if (parsed.kind !== "offer" && parsed.kind !== "answer") {
    throw new Error("Tipo di collegamento non riconosciuto.");
  }
  assertSessionId(parsed.sessionId);
  if (
    typeof parsed.createdAt !== "number" ||
    !Number.isSafeInteger(parsed.createdAt) ||
    parsed.createdAt > now + SIGNAL_CLOCK_SKEW_MS ||
    now - parsed.createdAt > SIGNAL_MAX_AGE_MS
  ) {
    throw new Error("Codice scaduto o orologio del dispositivo non sincronizzato.");
  }
  if (!isRecord(parsed.description) || parsed.description.type !== parsed.kind) {
    throw new Error("Risposta WebRTC non corrispondente al codice.");
  }
  assertSdp(parsed.description.sdp, parsed.kind);
  return parsed as ManualSignal;
}

export function parseManualSignal(
  code: string,
  expectedKind: SignalKind,
  expectedSessionId?: string,
  now = Date.now()
): ManualSignal {
  const message = decodeAndValidate(code.trim(), now);
  if (message.kind !== expectedKind) {
    throw new Error(expectedKind === "offer" ? "Incolla un invito, non una risposta." : "Incolla una risposta, non un invito.");
  }
  if (expectedSessionId && message.sessionId !== expectedSessionId) {
    throw new Error("La risposta appartiene a un'altra connessione.");
  }
  return message;
}

export function createManualSignal(
  kind: SignalKind,
  sessionId: string,
  sdp: string,
  now = Date.now()
): string {
  assertSessionId(sessionId);
  assertSdp(sdp, kind);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Timestamp non valido.");
  const signal: ManualSignal = {
    app: "mykingdom",
    version: 1,
    kind,
    sessionId,
    createdAt: now,
    description: { type: kind, sdp }
  };
  const code = SIGNAL_PREFIX + JSON.stringify(signal);
  if (code.length > SIGNAL_MAX_CHARS) throw new Error("Codice di collegamento troppo lungo.");
  return code;
}

export function makeHello(sessionId: string, peerId: string): WireMessage {
  assertSessionId(sessionId);
  assertSessionId(peerId);
  return { protocol: "mk-p2p-v1", type: "hello", sessionId, peerId };
}

export function makeHeartbeat(sessionId: string, sequence: number, answer = false): WireMessage {
  assertSessionId(sessionId);
  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error("Sequenza non valida.");
  return { protocol: "mk-p2p-v1", type: answer ? "pong" : "ping", sessionId, sequence };
}

export function encodeWire(message: WireMessage): string {
  return JSON.stringify(parseWire(JSON.stringify(message), message.sessionId));
}

export function parseWire(raw: string, expectedSessionId: string): WireMessage {
  assertSessionId(expectedSessionId);
  if (typeof raw !== "string" || raw.length > WIRE_MAX_CHARS) {
    throw new Error("Messaggio P2P troppo lungo.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Messaggio P2P non valido.");
  }
  if (!isRecord(parsed) || parsed.protocol !== "mk-p2p-v1" || parsed.sessionId !== expectedSessionId) {
    throw new Error("Protocollo o sessione P2P non corrispondente.");
  }
  if (parsed.type === "hello") {
    assertSessionId(parsed.peerId);
    return { protocol: "mk-p2p-v1", type: "hello", sessionId: expectedSessionId, peerId: parsed.peerId };
  }
  if (parsed.type === "ping" || parsed.type === "pong") {
    if (!Number.isSafeInteger(parsed.sequence) || (parsed.sequence as number) < 0) {
      throw new Error("Sequenza P2P non valida.");
    }
    return {
      protocol: "mk-p2p-v1",
      type: parsed.type,
      sessionId: expectedSessionId,
      sequence: parsed.sequence as number
    };
  }
  // No trade, currency or resource mutation messages in the handshake protocol.
  throw new Error("Operazione P2P non autorizzata in questa fase.");
}
