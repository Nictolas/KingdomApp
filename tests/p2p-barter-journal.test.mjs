import assert from "node:assert/strict";
import test from "node:test";
import { MemoryPersistentStorage } from "./memory-persistent-storage.mjs";
import {
  BarterJournalRepository, BARTER_JOURNAL_KEYS, MAX_JOURNAL_TRADES
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
  assert.equal(await store.getItem(BARTER_JOURNAL_KEYS.temp), null);
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
  await assert.rejects(() => repo(store, "altra-partita").read(), /illeggibili/);
  await assert.rejects(() => repo(store, "altra-partita").propose(offer(id(3)), "proposer"), /illeggibili/);
});

test("journal: scrittura temp interrompe prima del commit e conserva il primary", async () => {
  const store = new MemoryPersistentStorage();
  await repo(store).propose(offer(), "proposer");
  store.failSetFor.add(BARTER_JOURNAL_KEYS.temp);
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
  store.failSetFor.add(BARTER_JOURNAL_KEYS.primary);
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
  store.failSetFor.add(BARTER_JOURNAL_KEYS.backup);
  await assert.rejects(() => repo(store).reserve(tradeId, { wood: 100 }, 100));
  store.failSetFor.clear();
  const recovered = await repo(store).read();
  assert.equal(recovered.journal.records[tradeId].phase, "reserved");
});

test("journal: corruzione di una copia mantiene recupero solo lettura", async () => {
  const store = new MemoryPersistentStorage();
  await repo(store).propose(offer(), "proposer");
  await repo(store).reserve(tradeId, { wood: 100 }, 100);
  await store.setItem(BARTER_JOURNAL_KEYS.primary, "corrotto");
  const recovered = await repo(store).read();
  assert.equal(recovered.readOnlyRecovery, true);
  assert.equal(recovered.journal.revision, 1);
  await assert.rejects(() => repo(store).cancel(tradeId), /sola lettura/);
});

test("journal: tutte le copie corrotte non diventano una nuova partita vuota", async () => {
  const store = new MemoryPersistentStorage();
  await store.setItem(BARTER_JOURNAL_KEYS.primary, "corrotto");
  await assert.rejects(() => repo(store).read(), /illeggibili/);
  await assert.rejects(() => repo(store).propose(offer(), "proposer"), /illeggibili/);
});

test("journal: storage cifrato non leggibile blocca tutto", async () => {
  const store = new MemoryPersistentStorage();
  store.failGetFor.add(BARTER_JOURNAL_KEYS.primary);
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
