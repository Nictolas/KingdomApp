import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { EncryptedSaveStorage, ENCRYPTED_SAVE_PREFIX, EncryptedSaveDataError } from "../src/persistence/encryptedSaveStorage.ts";
import test from "node:test";
import { MemoryPersistentStorage } from "./memory-persistent-storage.mjs";
import {
  BarterJournalRepository, journalStorageKey, MAX_JOURNAL_TRADES
} from "../src/multiplayer/barterJournal.ts";
import { makeBarterOffer } from "../src/multiplayer/barterProtocol.ts";

const proposerId = "0123456789abcdef0123456789abcdef";
const responderId = "abcdef0123456789abcdef0123456789";
const saveId = "save-partita-uno";
const tradeId = "11111111111111111111111111111111";
const offer = (id = tradeId, amount = 10) => makeBarterOffer({
  tradeId: id, proposerId, responderId,
  gives: [{ resourceId: "wood", quantity: amount }],
  wants: [{ resourceId: "iron", quantity: 2 }]
});
const id = n => n.toString(16).padStart(32, "0");
const repo = (store, key = saveId) => new BarterJournalRepository(store, key, () => 1792850000000);

test("journal: proposta persistita e recuperata su nuovo repository dopo riavvio", async () => {
  const store = new MemoryPersistentStorage();
  const j1 = repo(store);
  await j1.propose(offer(), "proposer");
  const j2 = repo(store);
  const loaded = await j2.read();
  assert.equal(loaded.journal.version, 1);
  assert.equal(loaded.journal.revision, 1);
  assert.equal(loaded.journal.records[tradeId].phase, "proposed");
  assert.deepEqual(loaded.pendingReconciliation, []);
  assert.equal(loaded.readOnlyRecovery, false);
  assert.equal(await store.getItem(journalStorageKey("temp",saveId)), null);
});

test("journal: prenotazione persistente, nessun trasferimento e pending al riavvio", async () => {
  const store = new MemoryPersistentStorage();
  const a = repo(store);
  await a.propose(offer(), "proposer");
  await a.reserve(tradeId, { wood: 100, iron: 0 }, 100);
  const b = repo(store);
  const { journal, pendingReconciliation } = await b.read();
  assert.equal(journal.records[tradeId].phase, "reserved");
  assert.deepEqual(pendingReconciliation, [tradeId]);
  assert.equal(journal.records[tradeId].offer.gives[0].quantity, 10);
  assert.equal(journal.revision, 2);
  await b.cancel(tradeId);
  assert.equal((await repo(store).read()).journal.records[tradeId].phase, "cancelled");
  assert.deepEqual((await b.read()).pendingReconciliation, []);
  await assert.rejects(() => repo(store).propose(offer(), "proposer"), /già utilizzato/);
});

test("journal: blocca la doppia prenotazione delle risorse", async () => {
  const store = new MemoryPersistentStorage();
  const j = repo(store);
  const anotherId = id(2);
  await j.propose(offer(), "proposer");
  await j.reserve(tradeId, { wood: 15, iron: 0 }, 30);
  await j.propose(offer(anotherId), "proposer");
  await assert.rejects(
    () => j.reserve(anotherId, { wood: 15, iron: 0 }, 30),
    /insufficienti/
  );
  const state = await j.read();
  assert.equal(state.journal.records[anotherId].phase, "proposed");
});

test("journal: il salvataggio non può essere confuso con un'altra partita", async () => {
  const store = new MemoryPersistentStorage();
  await repo(store).propose(offer(), "proposer");
  const other = repo(store, "altra-partita");
  const separate = await other.read();
  assert.equal(separate.journal.revision, 0);
  assert.equal(Object.keys(separate.journal.records).length, 0);
  await other.propose(offer(id(3)), "proposer");
  assert.equal((await repo(store).read()).journal.revision, 1);
  assert.equal((await other.read()).journal.revision, 1);
  assert.notEqual(
    journalStorageKey("primary", saveId),
    journalStorageKey("primary", "altra-partita")
  );
});

test("journal: scrittura temp interrompe prima del commit e conserva il primary", async () => {
  const store = new MemoryPersistentStorage();
  await repo(store).propose(offer(), "proposer");
  store.failSetFor.add(journalStorageKey("temp",saveId));
  await assert.rejects(() => repo(store).reserve(tradeId, { wood: 100, iron: 0 }, 100));
  store.failSetFor.clear();
  const recovered = await repo(store).read();
  assert.equal(recovered.journal.records[tradeId].phase, "proposed");
  assert.deepEqual(recovered.pendingReconciliation, []);
});

test("journal: se crash dopo temp persistito prima del primary, recupera versione più recente", async () => {
  const store = new MemoryPersistentStorage();
  await repo(store).propose(offer(), "proposer");
  const a = repo(store);
  store.failSetFor.add(journalStorageKey("primary",saveId));
  await assert.rejects(() => a.reserve(tradeId, { wood: 100, iron: 0 }, 100));
  store.failSetFor.clear();
  const b = repo(store);
  const state = await b.read();
  assert.equal(state.journal.revision, 2);
  assert.equal(state.journal.records[tradeId].phase, "reserved");
  assert.deepEqual(state.pendingReconciliation, [tradeId]);
  await b.cancel(tradeId);
  assert.equal((await repo(store).read()).journal.records[tradeId].phase, "cancelled");
});

test("journal: errore su backup non perde una proposta valida, journal temp prevale", async () => {
  const store = new MemoryPersistentStorage();
  await repo(store).propose(offer(), "proposer");
  store.failSetFor.add(journalStorageKey("backup",saveId));
  await assert.rejects(() => repo(store).reserve(tradeId, { wood: 100 }, 100));
  store.failSetFor.clear();
  const recovered = await repo(store).read();
  assert.equal(recovered.journal.records[tradeId].phase, "reserved");
});

test("journal: corruzione di una copia mantiene recupero solo lettura", async () => {
  const store = new MemoryPersistentStorage();
  await repo(store).propose(offer(), "proposer");
  await repo(store).reserve(tradeId, { wood: 100 }, 100);
  await store.setItem(journalStorageKey("primary",saveId), "corrotto");
  const recovered = await repo(store).read();
  assert.equal(recovered.readOnlyRecovery, true);
  assert.equal(recovered.journal.revision, 1);
  await assert.rejects(() => repo(store).cancel(tradeId), /sola lettura/);
});

test("journal: tutte le copie corrotte non diventano una nuova partita vuota", async () => {
  const store = new MemoryPersistentStorage();
  await store.setItem(journalStorageKey("primary",saveId), "corrotto");
  await assert.rejects(() => repo(store).read(), /illeggibili/);
  await assert.rejects(() => repo(store).propose(offer(), "proposer"), /illeggibili/);
});

test("journal: storage cifrato non leggibile blocca tutto", async () => {
  const store = new MemoryPersistentStorage();
  store.failGetFor.add(journalStorageKey("primary",saveId));
  await assert.rejects(() => repo(store).read(), /Impossibile leggere/);
});

test("journal: proposte duplicate idem, ID già conclusi non riutilizzabili", async () => {
  const store = new MemoryPersistentStorage();
  const j = repo(store);
  await j.propose(offer(), "proposer");
  const firstRevision = (await j.read()).journal.revision;
  await j.propose(offer(), "proposer");
  assert.equal((await j.read()).journal.revision, firstRevision);
  await assert.rejects(() => j.propose(offer(tradeId, 2), "proposer"), /già utilizzato/);
  await j.cancel(tradeId);
  await j.cancel(tradeId);
  assert.equal((await j.read()).journal.revision, firstRevision + 1);
  await assert.rejects(() => j.reserve(tradeId, { wood: 100 }, 100), /non disponibile/);
});

test("journal: operazioni concorrenti nello stesso processo sono serializzate", async () => {
  const store = new MemoryPersistentStorage();
  const j = repo(store);
  const ids = [id(10), id(11), id(12), id(13)];
  await Promise.all(ids.map(tradeId => j.propose(offer(tradeId, 1), "proposer")));
  const loaded = await j.read();
  assert.equal(Object.keys(loaded.journal.records).length, 4);
  assert.equal(loaded.journal.revision, 4);
});

test("journal: capienza e quantità non sicure vengono rifiutate senza scrivere", async () => {
  const store = new MemoryPersistentStorage();
  const j = repo(store);
  await j.propose(offer(), "proposer");
  await assert.rejects(() => j.reserve(tradeId, { wood: 9, iron: 0 }, 100), /insufficienti/);
  await assert.rejects(() => j.reserve(tradeId, { wood: 10, iron: 5 }, 14), /capienza/i);
  assert.equal((await j.read()).journal.revision, 1);
  assert.equal((await j.read()).journal.records[tradeId].phase, "proposed");
});

test("journal: accettazione salvata e riconciliazione richiesta dopo riavvio", async () => {
  const store = new MemoryPersistentStorage();
  await repo(store).propose(offer(), "proposer");
  await repo(store).decide(tradeId, true);
  const restarted = repo(store);
  const state = await restarted.read();
  assert.equal(state.journal.records[tradeId].phase, "accepted");
  assert.deepEqual(state.pendingReconciliation, [tradeId]);
  await restarted.decide(tradeId, true);
  assert.equal((await restarted.read()).journal.revision, 2);
  await assert.rejects(() => restarted.decide(tradeId, false), /riconciliazione/);
  await assert.rejects(() => restarted.cancel(tradeId), /riconciliazione/);
});

test("journal: rifiuto salvato e nessuna riattivazione dopo riavvio", async () => {
  const store = new MemoryPersistentStorage();
  await repo(store).propose(offer(), "responder");
  await repo(store).decide(tradeId, false);
  const state = await repo(store).read();
  assert.equal(state.journal.records[tradeId].phase, "cancelled");
  assert.deepEqual(state.pendingReconciliation, []);
  await repo(store).decide(tradeId, false);
  await assert.rejects(() => repo(store).decide(tradeId, true), /non disponibile/);
});

/** Real AES-256-GCM, same per-slot AAD contract as native Expo crypto. */
function testAesGcmCipher() {
  const key = randomBytes(32);
  return {
    async encrypt(slot, plaintext) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(Buffer.from("mykingdom-save-slot:v1:" + slot));
      const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      return Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64");
    },
    async decrypt(slot, raw) {
      const data = Buffer.from(raw, "base64");
      const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
      decipher.setAAD(Buffer.from("mykingdom-save-slot:v1:" + slot));
      decipher.setAuthTag(data.subarray(-16));
      return Buffer.concat([decipher.update(data.subarray(12, -16)), decipher.final()]).toString("utf8");
    }
  };
}

test("journal cifrato: primary AES-GCM manomesso, backup integro recuperato in sola lettura", async () => {
  const raw = new MemoryPersistentStorage();
  const protectedStorage = new EncryptedSaveStorage(raw, testAesGcmCipher());
  const j = repo(protectedStorage);
  await j.propose(offer(), "proposer");
  await j.reserve(tradeId, { wood: 100, iron: 0 }, 100);
  const primary = journalStorageKey("primary", saveId);
  const backup = journalStorageKey("backup", saveId);
  assert.match(await raw.getItem(primary), /^mk:aes256gcm:v1:/);
  assert.match(await raw.getItem(backup), /^mk:aes256gcm:v1:/);

  const data = Buffer.from((await raw.getItem(primary)).slice(ENCRYPTED_SAVE_PREFIX.length), "base64");
  data[18] ^= 0x40;
  await raw.setItem(primary, ENCRYPTED_SAVE_PREFIX + data.toString("base64"));
  await assert.rejects(() => protectedStorage.getItem(primary), EncryptedSaveDataError);
  const recovered = await repo(protectedStorage).read();
  assert.equal(recovered.readOnlyRecovery, true);
  assert.equal(recovered.journal.revision, 1);
  assert.equal(recovered.journal.records[tradeId].phase, "proposed");
  await assert.rejects(() => repo(protectedStorage).cancel(tradeId), /sola lettura/);
  assert.equal(await raw.getItem(primary), ENCRYPTED_SAVE_PREFIX + data.toString("base64"));
});

test("journal cifrato: tutte le copie AES-GCM manomesse bloccano definitivamente nuove scritture", async () => {
  const raw = new MemoryPersistentStorage();
  const protectedStorage = new EncryptedSaveStorage(raw, testAesGcmCipher());
  await repo(protectedStorage).propose(offer(), "proposer");
  await repo(protectedStorage).reserve(tradeId, { wood: 100 }, 100);
  for (const slot of ["primary", "backup"]) {
    const key = journalStorageKey(slot, saveId);
    await raw.setItem(key, ENCRYPTED_SAVE_PREFIX + "corrupted-ciphertext");
  }
  await assert.rejects(() => repo(protectedStorage).read(), /illeggibili/);
  await assert.rejects(() => repo(protectedStorage).propose(offer(id(99)), "proposer"), /illeggibili/);
});

test("journal cifrato: slot non cifrato non diventa una proposta valida tramite backup", async () => {
  const raw = new MemoryPersistentStorage();
  const protectedStorage = new EncryptedSaveStorage(raw, testAesGcmCipher());
  await repo(protectedStorage).propose(offer(), "proposer");
  await repo(protectedStorage).reserve(tradeId, { wood: 100 }, 100);
  const primary = journalStorageKey("primary", saveId);
  await raw.setItem(primary, JSON.stringify({ fake: "plaintext" }));
  const recovered = await repo(protectedStorage).read();
  assert.equal(recovered.readOnlyRecovery, true);
  await assert.rejects(() => repo(protectedStorage).reserve(tradeId, { wood: 100 }, 100), /sola lettura/);
});
