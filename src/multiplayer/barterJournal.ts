/**
 * Journal durevole dei baratti. È un *blocco preparatorio*:
 * registra proposte e prenotazioni, ma non applica mai modifiche alle risorse.
 *
 * Usare esclusivamente PersistentStorage proveniente da createGameSaveStorage()
 * sui telefoni (AES-256-GCM con AAD per slot). Il repository non deve essere
 * collegato a un salvataggio differente: saveId è verificato ad ogni lettura.
 *
 * Una coppia P2P senza coordinatore non offre commit atomico tra dispositivi.
 * Al riavvio le prenotazioni devono rimanere bloccate per riconciliazione.
 */
import type { PersistentStorage } from "../persistence/storage.ts";
import {
  reserveLocalBarter,
  validateBarterOffer,
  type BarterOffer,
  type BarterInventory,
  type LocalBarterLedger,
  type LocalBarterReservation
} from "./barterProtocol.ts";

export const BARTER_JOURNAL_KEYS = {
  primary: "mykingdom.barter.journal.primary.v1",
  backup: "mykingdom.barter.journal.backup.v1",
  temp: "mykingdom.barter.journal.temp.v1"
} as const;

/**
 * Slot isolati per saveId, senza hash e quindi senza collisioni fra partite.
 * L'archivio di un'altra partita non viene sovrascritto e non ne sblocca i trade.
 */
export function journalStorageKey(
  slot: keyof typeof BARTER_JOURNAL_KEYS,
  saveId: string
): string {
  if (!validSaveId(saveId)) throw new Error("Save ID del journal non valido.");
  return BARTER_JOURNAL_KEYS[slot] + ":" + encodeURIComponent(saveId);
}

export const MAX_JOURNAL_TRADES = 2048;
type BarterJournalPhase = "proposed" | "accepted" | "reserved" | "cancelled";
export type BarterJournalRecord = {
  offer: BarterOffer;
  role: LocalBarterReservation["role"];
  phase: BarterJournalPhase;
  updatedAt: number;
};
export type BarterJournal = {
  version: 1;
  saveId: string;
  revision: number;
  records: Record<string, BarterJournalRecord>;
};
export type JournalReadResult = {
  journal: BarterJournal;
  /** Presence of a pending reservation requires contacting the other peer. */
  pendingReconciliation: string[];
  /** Corrupt slot: snapshot is viewable but all writes must stop. */
  readOnlyRecovery: boolean;
};
const ID_PATTERN = /^[0-9a-f]{32}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function validSaveId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 256;
}
function assertTimestamp(v: unknown): asserts v is number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) {
    throw new Error("Timestamp del journal P2P non valido.");
  }
}
function validateJournal(value: unknown, saveId: string): BarterJournal {
  if (!isRecord(value) || value.version !== 1 ||
      value.saveId !== saveId || !Number.isSafeInteger(value.revision) ||
      (value.revision as number) < 0 || !isRecord(value.records)) {
    throw new Error("Journal P2P non valido o riferito a un'altra partita.");
  }
  const keys = Object.keys(value.records);
  if (keys.length > MAX_JOURNAL_TRADES) throw new Error("Journal P2P troppo grande.");
  const records: Record<string, BarterJournalRecord> = Object.create(null);
  for (const key of keys) {
    const r = value.records[key];
    if (!ID_PATTERN.test(key) || !isRecord(r) ||
        (r.phase !== "proposed" && r.phase !== "accepted" && r.phase !== "reserved" && r.phase !== "cancelled") ||
        (r.role !== "proposer" && r.role !== "responder")) {
      throw new Error("Record del journal P2P non valido.");
    }
    assertTimestamp(r.updatedAt);
    const offer = validateBarterOffer(r.offer);
    if (offer.tradeId !== key) throw new Error("Identificativo incoerente nel journal P2P.");
    records[key] = { offer, role: r.role, phase: r.phase, updatedAt: r.updatedAt };
  }
  return { version: 1, saveId, revision: value.revision as number, records };
}
function newJournal(saveId: string): BarterJournal {
  return { version: 1, saveId, revision: 0, records: Object.create(null) };
}
function canonical(journal: BarterJournal): string {
  return JSON.stringify(journal);
}
function sameOffer(a: BarterOffer, b: BarterOffer): boolean {
  const lines = (values: BarterOffer["gives"]) =>
    [...values].sort((a, b) => a.resourceId.localeCompare(b.resourceId));
  return a.tradeId === b.tradeId &&
    a.proposerId === b.proposerId && a.responderId === b.responderId &&
    JSON.stringify(lines(a.gives)) === JSON.stringify(lines(b.gives)) &&
    JSON.stringify(lines(a.wants)) === JSON.stringify(lines(b.wants));
}

/**
 * Each slot is a single key write. Commit protocol:
 * temp -> verify -> backup(previous primary) -> primary -> verify -> remove temp.
 * Recovery chooses highest valid revision, including a newer temp after crash.
 * Concurrent writers from different processes/devices are NOT supported.
 */
export class BarterJournalRepository {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly storage: PersistentStorage,
    private readonly saveId: string,
    private readonly now: () => number = Date.now
  ) {
    if (!validSaveId(saveId)) throw new Error("Salvataggio P2P senza identificativo valido.");
  }

  private async readSlots(): Promise<{ journal: BarterJournal; damaged: boolean }> {
    const keys = (Object.keys(BARTER_JOURNAL_KEYS) as Array<keyof typeof BARTER_JOURNAL_KEYS>)
      .map(slot => journalStorageKey(slot, this.saveId));
    let present = false;
    let damaged = false;
    const valid: BarterJournal[] = [];
    for (const key of keys) {
      let raw: string | null;
      try {
        raw = await this.storage.getItem(key);
      } catch {
        // Lost key or inaccessible encrypted store: do not pretend this is an empty journal.
        throw new Error("Impossibile leggere il journal P2P protetto. Nessuna operazione consentita.");
      }
      if (raw === null) continue;
      present = true;
      try { valid.push(validateJournal(JSON.parse(raw), this.saveId)); }
      catch { damaged = true; }
    }
    if (present && valid.length === 0) {
      throw new Error("Tutte le copie del journal P2P sono illeggibili: operazioni bloccate.");
    }
    if (valid.length === 0) return { journal: newJournal(this.saveId), damaged: false };
    valid.sort((a, b) => b.revision - a.revision);
    if (valid.length > 1 && valid[0].revision === valid[1].revision &&
        canonical(valid[0]) !== canonical(valid[1])) {
      throw new Error("Revisioni P2P discordanti: riconciliazione manuale richiesta.");
    }
    return { journal: valid[0], damaged };
  }

  async read(): Promise<JournalReadResult> {
    const { journal, damaged } = await this.readSlots();
    const pendingReconciliation = Object.entries(journal.records)
      .filter(([, r]) => r.phase === "reserved" || r.phase === "accepted")
      .map(([id]) => id);
    return { journal, pendingReconciliation, readOnlyRecovery: damaged };
  }

  private mutate<T>(fn: (state: BarterJournal) => { next: BarterJournal; value: T }): Promise<T> {
    const run = this.queue.catch(() => undefined).then(async () => {
      const { journal, damaged } = await this.readSlots();
      if (damaged) throw new Error("Journal P2P corrotto: ripristino in sola lettura.");
      const { next, value } = fn(journal);
      if (next !== journal) {
        if (!Number.isSafeInteger(journal.revision + 1)) throw new Error("Revisioni del journal esaurite.");
        const validated = validateJournal({ ...next, revision: journal.revision + 1 }, this.saveId);
        await this.commit(validated, journal);
      }
      return value;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async commit(next: BarterJournal, previous: BarterJournal): Promise<void> {
    const nextRaw = canonical(next);
    await this.storage.setItem(journalStorageKey("temp", this.saveId), nextRaw);
    const verifyTemp = await this.storage.getItem(journalStorageKey("temp", this.saveId));
    if (verifyTemp === null || canonical(validateJournal(JSON.parse(verifyTemp), this.saveId)) !== nextRaw) {
      throw new Error("Journal P2P temporaneo non verificato.");
    }
    // Backup only if a primary actually existed; an in-memory empty journal is
    // not an on-disk checkpoint. Never destroy a recoverable backup with garbage.
    const primary = await this.storage.getItem(journalStorageKey("primary", this.saveId));
    if (primary !== null) {
      validateJournal(JSON.parse(primary), this.saveId);
      await this.storage.setItem(journalStorageKey("backup", this.saveId), primary);
    } else if (previous.revision > 0) {
      // May be recovering an interrupted write with only a temp slot.
      // In that case, do not manufacture a stale backup.
    }
    await this.storage.setItem(journalStorageKey("primary", this.saveId), nextRaw);
    const verifyPrimary = await this.storage.getItem(journalStorageKey("primary", this.saveId));
    if (verifyPrimary === null ||
        canonical(validateJournal(JSON.parse(verifyPrimary), this.saveId)) !== nextRaw) {
      throw new Error("Journal P2P principale non verificato.");
    }
    await this.storage.removeItem(journalStorageKey("temp", this.saveId));
  }

  propose(offerInput: unknown, role: LocalBarterReservation["role"]): Promise<BarterJournalRecord> {
    const offer = validateBarterOffer(offerInput);
    if (role !== "proposer" && role !== "responder") {
      return Promise.reject(new Error("Ruolo P2P non valido."));
    }
    return this.mutate(journal => {
      const existing = journal.records[offer.tradeId];
      if (existing) {
        if (!sameOffer(existing.offer, offer) || existing.role !== role || existing.phase === "cancelled") {
          throw new Error("ID baratto già utilizzato.");
        }
        return { next: journal, value: existing };
      }
      if (Object.keys(journal.records).length >= MAX_JOURNAL_TRADES) {
        throw new Error("Archivio baratti pieno: effettuare prima la riconciliazione.");
      }
      const record: BarterJournalRecord = {
        offer, role, phase: "proposed", updatedAt: this.timestamp()
      };
      return { next: { ...journal, records: { ...journal.records, [offer.tradeId]: record } }, value: record };
    });
  }

  /**
   * Validates the current stock snapshot against ALL already reserved offers.
   * Do not use this for real stock changes until every game mutation is guarded.
   * If the peer is offline after a crash, reserved entries stay locked.
   */
  reserve(id: string, stock: BarterInventory, capacity: number): Promise<BarterJournalRecord> {
    if (!ID_PATTERN.test(id)) return Promise.reject(new Error("ID baratto non valido."));
    return this.mutate(journal => {
      const record = journal.records[id];
      if (!record || record.phase === "cancelled") throw new Error("Baratto non disponibile.");
      if (record.phase === "reserved") return { next: journal, value: record };
      const ledger: LocalBarterLedger = {
        stock,
        capacity,
        reservations: Object.create(null)
      };
      for (const [key, r] of Object.entries(journal.records)) {
        if (r.phase !== "reserved") continue;
        ledger.reservations[key] = { offer: r.offer, role: r.role, status: "reserved" };
      }
      reserveLocalBarter(ledger, record.offer, record.role);
      const reserved: BarterJournalRecord = { ...record, phase: "reserved", updatedAt: this.timestamp() };
      return { next: { ...journal, records: { ...journal.records, [id]: reserved } }, value: reserved };
    });
  }

  /** Records a proposal response durably before sending it to the peer.
   * Does not move any inventory. Conflicting duplicate responses fail closed. */
  decide(id: string, accepted: boolean): Promise<BarterJournalRecord> {
    if (!ID_PATTERN.test(id) || typeof accepted !== "boolean") {
      return Promise.reject(new Error("Risposta al baratto non valida."));
    }
    return this.mutate(journal => {
      const record = journal.records[id];
      if (!record || record.phase === "cancelled") {
        if (record?.phase === "cancelled" && !accepted) return { next: journal, value: record };
        throw new Error("Baratto non disponibile per questa risposta.");
      }
      if (record.phase === "reserved" || record.phase === "accepted") {
        if (accepted) return { next: journal, value: record };
        throw new Error("Una proposta già accettata richiede riconciliazione prima di annullarla.");
      }
      const decision: BarterJournalRecord = {
        ...record, phase: accepted ? "accepted" : "cancelled", updatedAt: this.timestamp()
      };
      return {
        next: { ...journal, records: { ...journal.records, [id]: decision } },
        value: decision
      };
    });
  }

  /** Local cancellation is possible only before entering a commit phase. */
  cancel(id: string): Promise<void> {
    if (!ID_PATTERN.test(id)) return Promise.reject(new Error("ID baratto non valido."));
    return this.mutate(journal => {
      const record = journal.records[id];
      if (!record || record.phase === "cancelled") return { next: journal, value: undefined };
      if (record.phase === "accepted") {
        throw new Error("Proposta accettata: attendi la riconciliazione con l'altro giocatore.");
      }
      const cancelled: BarterJournalRecord = { ...record, phase: "cancelled", updatedAt: this.timestamp() };
      return { next: { ...journal, records: { ...journal.records, [id]: cancelled } }, value: undefined };
    });
  }

  private timestamp(): number {
    const n = this.now();
    assertTimestamp(n);
    return n;
  }
}
