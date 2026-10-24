/**
 * MyKingdom – protocollo proposte di baratto P2P (fase preparatoria).
 *
 * Nessun trasferimento di risorse avviene qui: bisogna prima integrare un
 * journal persistente e una riconciliazione sicura nel salvataggio del gioco.
 * Le quantità sono numeri aggregati e non singoli oggetti.
 */
export const BARTER_PROTOCOL = "mk-barter-v1" as const;
export const BARTER_MAX_WIRE_CHARS = 32_768;
export const BARTER_MAX_LINES = 256;
const ID_PATTERN = /^[0-9a-f]{32}$/;
const RESOURCE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/;

export type BarterLine = { resourceId: string; quantity: number };
export type BarterOffer = {
  protocol: typeof BARTER_PROTOCOL;
  tradeId: string;
  proposerId: string;
  responderId: string;
  gives: BarterLine[];
  wants: BarterLine[];
};

export type BarterMessage =
  | { protocol: typeof BARTER_PROTOCOL; type: "propose"; offer: BarterOffer }
  | { protocol: typeof BARTER_PROTOCOL; type: "respond"; tradeId: string; accepted: boolean };

export type BarterInventory = Record<string, number>;
export type LocalBarterReservation = {
  offer: BarterOffer;
  role: "proposer" | "responder";
  status: "reserved" | "released";
};
export type LocalBarterLedger = {
  stock: BarterInventory;
  capacity: number;
  reservations: Record<string, LocalBarterReservation>;
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function tradeId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new Error("Identificativo di baratto non valido.");
  }
}
function positiveAmount(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Quantità del baratto non valida: serve un intero positivo sicuro.");
  }
}
function nonnegativeAmount(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Scorta o capienza non valida.");
  }
}
function safeSum(a: number, b: number): number {
  const result = a + b;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error("La somma supera i limiti numerici sicuri del gioco.");
  }
  return result;
}
function assertLines(value: unknown): BarterLine[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > BARTER_MAX_LINES) {
    throw new Error("Elenco risorse del baratto vuoto o troppo lungo.");
  }
  const seen = new Set<string>();
  const lines: BarterLine[] = [];
  for (const entry of value) {
    if (!record(entry) || typeof entry.resourceId !== "string" ||
        !RESOURCE_PATTERN.test(entry.resourceId)) {
      throw new Error("Risorsa del baratto non valida.");
    }
    positiveAmount(entry.quantity);
    if (seen.has(entry.resourceId)) throw new Error("Risorsa duplicata nel baratto.");
    seen.add(entry.resourceId);
    lines.push({ resourceId: entry.resourceId, quantity: entry.quantity });
  }
  return lines;
}
export function validateBarterOffer(value: unknown): BarterOffer {
  if (!record(value) || value.protocol !== BARTER_PROTOCOL) {
    throw new Error("Protocollo del baratto non supportato.");
  }
  tradeId(value.tradeId);
  tradeId(value.proposerId);
  tradeId(value.responderId);
  if (value.proposerId === value.responderId) {
    throw new Error("Non puoi barattare con il tuo stesso dispositivo.");
  }
  const gives = assertLines(value.gives);
  const wants = assertLines(value.wants);
  return {
    protocol: BARTER_PROTOCOL,
    tradeId: value.tradeId,
    proposerId: value.proposerId,
    responderId: value.responderId,
    gives,
    wants
  };
}

export function makeBarterOffer(input: Omit<BarterOffer, "protocol">): BarterOffer {
  return validateBarterOffer({ protocol: BARTER_PROTOCOL, ...input });
}

export function parseBarterWire(raw: string): BarterMessage {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > BARTER_MAX_WIRE_CHARS) {
    throw new Error("Messaggio di baratto vuoto o troppo lungo.");
  }
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new Error("Messaggio di baratto danneggiato."); }
  if (!record(data) || data.protocol !== BARTER_PROTOCOL) {
    throw new Error("Versione del messaggio di baratto non valida.");
  }
  if (data.type === "propose") {
    return { protocol: BARTER_PROTOCOL, type: "propose", offer: validateBarterOffer(data.offer) };
  }
  if (data.type === "respond") {
    tradeId(data.tradeId);
    if (typeof data.accepted !== "boolean") throw new Error("Risposta al baratto non valida.");
    return { protocol: BARTER_PROTOCOL, type: "respond", tradeId: data.tradeId, accepted: data.accepted };
  }
  throw new Error("Messaggio di baratto non autorizzato: nessun trasferimento in questa fase.");
}
export function encodeBarterWire(msg: BarterMessage): string {
  // Round-trip validation prevents accidental unvalidated local transmissions.
  const raw = JSON.stringify(msg);
  parseBarterWire(raw);
  return JSON.stringify(parseBarterWire(raw));
}
function assertInventory(stock: BarterInventory, capacity: number): number {
  nonnegativeAmount(capacity);
  if (!record(stock)) throw new Error("Inventario non valido.");
  let total = 0;
  for (const [id, quantity] of Object.entries(stock)) {
    if (!RESOURCE_PATTERN.test(id)) throw new Error("Risorsa in inventario non valida.");
    nonnegativeAmount(quantity);
    total = safeSum(total, quantity);
  }
  if (total > capacity) throw new Error("Scorte attuali superiori alla capienza del magazzino.");
  return total;
}
function linesForRole(offer: BarterOffer, role: LocalBarterReservation["role"]) {
  return role === "proposer"
    ? { out: offer.gives, incoming: offer.wants }
    : { out: offer.wants, incoming: offer.gives };
}
function sameOffer(a: BarterOffer, b: BarterOffer): boolean {
  // Compare canonicalized, sorted resource lines; proposals never mutate on retry.
  const normalize = (items: BarterLine[]) => [...items].sort((x, y) => x.resourceId.localeCompare(y.resourceId));
  return a.tradeId === b.tradeId &&
    a.proposerId === b.proposerId && a.responderId === b.responderId &&
    JSON.stringify(normalize(a.gives)) === JSON.stringify(normalize(b.gives)) &&
    JSON.stringify(normalize(a.wants)) === JSON.stringify(normalize(b.wants));
}
/**
 * Prenota senza sottrarre scorte: le quantità sono trattenute a livello
 * logico finché il journal transazionale non implementerà il trasferimento.
 *
 * `capacity` è obbligatoria e rappresenta il limite in unità aggregate
 * dell'inventario; l'integrazione con il gioco dovrà usare la sua vera capienza.
 */
export function reserveLocalBarter(
  ledger: LocalBarterLedger,
  proposed: unknown,
  role: LocalBarterReservation["role"]
): LocalBarterLedger {
  const offer = validateBarterOffer(proposed);
  if (role !== "proposer" && role !== "responder") throw new Error("Ruolo di baratto non valido.");
  const existing = ledger.reservations[offer.tradeId];
  if (existing) {
    if (existing.status === "reserved" && existing.role === role && sameOffer(existing.offer, offer)) return ledger;
    throw new Error("Identificativo di baratto già utilizzato o concluso.");
  }
  const currentTotal = assertInventory(ledger.stock, ledger.capacity);
  const reserved: BarterInventory = {};
  let inboundHeld = 0;
  for (const entry of Object.values(ledger.reservations)) {
    if (entry.status !== "reserved") continue;
    const prior = linesForRole(validateBarterOffer(entry.offer), entry.role);
    for (const line of prior.out) {
      reserved[line.resourceId] = safeSum(reserved[line.resourceId] ?? 0, line.quantity);
    }
    for (const line of prior.incoming) inboundHeld = safeSum(inboundHeld, line.quantity);
  }

  const { out, incoming } = linesForRole(offer, role);
  let giveTotal = 0;
  let receiveTotal = 0;
  for (const line of out) {
    const stock = ledger.stock[line.resourceId] ?? 0;
    nonnegativeAmount(stock);
    const held = reserved[line.resourceId] ?? 0;
    if (line.quantity > stock || held > stock - line.quantity) {
      throw new Error("Risorse insufficienti: alcune sono già prenotate per un altro baratto.");
    }
    giveTotal = safeSum(giveTotal, line.quantity);
  }
  for (const line of incoming) receiveTotal = safeSum(receiveTotal, line.quantity);
  const projected = safeSum(currentTotal, safeSum(inboundHeld, receiveTotal));
  if (projected - giveTotal > ledger.capacity) {
    throw new Error("Capienza del magazzino insufficiente dopo il baratto.");
  }

  return {
    stock: { ...ledger.stock },
    capacity: ledger.capacity,
    reservations: {
      ...ledger.reservations,
      [offer.tradeId]: { offer, role, status: "reserved" }
    }
  };
}

/** Release is idempotent but its tradeId cannot be reused (replay prevention). */
export function releaseLocalBarter(ledger: LocalBarterLedger, id: string): LocalBarterLedger {
  tradeId(id);
  const existing = ledger.reservations[id];
  if (!existing || existing.status === "released") return ledger;
  return {
    ...ledger,
    reservations: {
      ...ledger.reservations,
      [id]: { ...existing, status: "released" }
    }
  };
}

/** Explicitly disallow a remote signal from mutating inventory before
 * durable two-party settlement and recovery have been implemented. */
export function applyRemoteBarterMessageToStock(): never {
  throw new Error("Trasferimento P2P bloccato: journal persistente e riconciliazione non ancora disponibili.");
}
