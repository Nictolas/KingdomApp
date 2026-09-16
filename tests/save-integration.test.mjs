import assert from "node:assert/strict";
import test from "node:test";

import { AsyncStoragePersistentStorage } from "../src/persistence/asyncStorageAdapter.ts";
import { gameSaveV1ToGameState, gameStateToGameSaveV1 } from "../src/persistence/gameStateMapping.ts";
import { SaveRepository, SAVE_BACKUP_KEY, SAVE_PRIMARY_KEY, SAVE_TEMP_KEY } from "../src/persistence/saveRepository.ts";
import { deserializeSave, serializeSave } from "../src/persistence/saveSerializer.ts";
import { MemoryPersistentStorage } from "./memory-persistent-storage.mjs";
import { createSaveEnvelope } from "./save-fixture.mjs";

function stateFromFixture() {
  return gameSaveV1ToGameState(createSaveEnvelope().payload);
}

test("l'adapter AsyncStorage delega tutte le operazioni al driver", async () => {
  const driver = new MemoryPersistentStorage();
  const adapter = new AsyncStoragePersistentStorage(driver);
  await adapter.setItem("chiave", "valore");
  assert.equal(await adapter.getItem("chiave"), "valore");
  await adapter.removeItem("chiave");
  assert.equal(await adapter.getItem("chiave"), null);
});

test("loadBestAvailable preferisce primary valido", async () => {
  const storage = new MemoryPersistentStorage();
  const primary = createSaveEnvelope();
  storage.values.set(SAVE_PRIMARY_KEY, serializeSave(primary));
  const result = await new SaveRepository(storage).loadBestAvailable();
  assert.equal(result.source, "primary");
  assert.equal(result.save?.metadata.saveId, primary.metadata.saveId);
});

test("loadBestAvailable recupera un temp valido più recente del primary", async () => {
  const storage = new MemoryPersistentStorage();
  const primary = createSaveEnvelope();
  primary.metadata.updatedAt = "2026-08-29T10:00:00.000Z";
  const temp = createSaveEnvelope();
  temp.metadata.saveId = "temp-recuperato";
  temp.metadata.updatedAt = "2026-08-29T10:01:00.000Z";
  storage.values.set(SAVE_PRIMARY_KEY, serializeSave(primary));
  storage.values.set(SAVE_TEMP_KEY, serializeSave(temp));

  const result = await new SaveRepository(storage).loadBestAvailable();

  assert.equal(result.source, "temp");
  assert.equal(result.save?.metadata.saveId, "temp-recuperato");
});

test("loadBestAvailable ignora un temp valido più vecchio del primary", async () => {
  const storage = new MemoryPersistentStorage();
  const primary = createSaveEnvelope();
  primary.metadata.saveId = "primary-recente";
  primary.metadata.updatedAt = "2026-08-29T10:01:00.000Z";
  const temp = createSaveEnvelope();
  temp.metadata.updatedAt = "2026-08-29T10:00:00.000Z";
  storage.values.set(SAVE_PRIMARY_KEY, serializeSave(primary));
  storage.values.set(SAVE_TEMP_KEY, serializeSave(temp));

  const result = await new SaveRepository(storage).loadBestAvailable();

  assert.equal(result.source, "primary");
  assert.equal(result.save?.metadata.saveId, "primary-recente");
});

test("loadBestAvailable ignora un temp corrotto", async () => {
  const storage = new MemoryPersistentStorage();
  const primary = createSaveEnvelope();
  primary.metadata.saveId = "primary-valido";
  storage.values.set(SAVE_PRIMARY_KEY, serializeSave(primary));
  storage.values.set(SAVE_TEMP_KEY, "{corrotto");

  const result = await new SaveRepository(storage).loadBestAvailable();

  assert.equal(result.source, "primary");
  assert.equal(result.save?.metadata.saveId, "primary-valido");
});

test("loadBestAvailable usa backup se primary è assente", async () => {
  const storage = new MemoryPersistentStorage();
  const backup = createSaveEnvelope();
  backup.metadata.saveId = "backup-only";
  storage.values.set(SAVE_BACKUP_KEY, serializeSave(backup));
  const result = await new SaveRepository(storage).loadBestAvailable();
  assert.equal(result.source, "backup");
  assert.equal(result.save?.metadata.saveId, "backup-only");
});

test("loadBestAvailable usa backup se primary è corrotto o non leggibile", async () => {
  for (const erroreLettura of [false, true]) {
    const storage = new MemoryPersistentStorage();
    const backup = createSaveEnvelope();
    backup.metadata.saveId = "backup-valido";
    storage.values.set(SAVE_PRIMARY_KEY, "{corrotto");
    storage.values.set(SAVE_BACKUP_KEY, serializeSave(backup));
    if (erroreLettura) storage.failGetFor.add(SAVE_PRIMARY_KEY);
    const result = await new SaveRepository(storage).loadBestAvailable();
    assert.equal(result.source, "backup");
    assert.equal(result.save?.metadata.saveId, "backup-valido");
  }
});

test("loadBestAvailable restituisce none senza propagare errori", async () => {
  const storage = new MemoryPersistentStorage();
  storage.values.set(SAVE_PRIMARY_KEY, "non-json");
  storage.values.set(SAVE_BACKUP_KEY, "non-json");
  storage.values.set(SAVE_TEMP_KEY, "non-json");
  const result = await new SaveRepository(storage).loadBestAvailable();
  assert.deepEqual(result, { source: "none", save: null });
});

test("salvataggi simultanei vengono serializzati e l'ultimo resta nel primary", async () => {
  class TrackingStorage extends MemoryPersistentStorage {
    activeSets = 0;
    maxActiveSets = 0;

    async setItem(key, value) {
      this.activeSets += 1;
      this.maxActiveSets = Math.max(this.maxActiveSets, this.activeSets);
      try {
        await new Promise((resolve) => setTimeout(resolve, 5));
        await super.setItem(key, value);
      } finally {
        this.activeSets -= 1;
      }
    }
  }

  const storage = new TrackingStorage();
  const repository = new SaveRepository(storage);
  const first = createSaveEnvelope();
  first.metadata.saveId = "prima";
  first.metadata.updatedAt = "2026-08-29T10:00:00.000Z";
  const second = createSaveEnvelope();
  second.metadata.saveId = "seconda";
  second.metadata.updatedAt = "2026-08-29T10:01:00.000Z";

  await Promise.all([repository.save(first), repository.save(second)]);

  assert.equal(storage.maxActiveSets, 1);
  assert.equal(deserializeSave(await storage.getItem(SAVE_PRIMARY_KEY)).metadata.saveId, "seconda");
  assert.equal(deserializeSave(await storage.getItem(SAVE_BACKUP_KEY)).metadata.saveId, "prima");
  assert.equal(await storage.getItem(SAVE_TEMP_KEY), null);
});

test("un errore in un salvataggio non blocca i successivi nella coda", async () => {
  const storage = new MemoryPersistentStorage();
  const repository = new SaveRepository(storage);
  storage.failSetFor.add(SAVE_PRIMARY_KEY);
  await assert.rejects(() => repository.save(createSaveEnvelope()));

  storage.failSetFor.delete(SAVE_PRIMARY_KEY);
  const next = createSaveEnvelope();
  next.metadata.saveId = "dopo-errore";
  await repository.save(next);

  assert.equal(deserializeSave(await storage.getItem(SAVE_PRIMARY_KEY)).metadata.saveId, "dopo-errore");
});

test("mapping bidirezionale non perde alcun dato persistente", () => {
  const initial = stateFromFixture();
  const restored = gameSaveV1ToGameState(gameStateToGameSaveV1(initial));
  assert.deepEqual(restored, initial);
  assert.equal(restored.scaglioniConfig.at(-1)?.max, Infinity);
  assert.deepEqual(restored.mappa, initial.mappa);
  assert.deepEqual(restored.eventiInCorso, initial.eventiInCorso);
  assert.deepEqual(restored.richiesteInAttesa, initial.richiesteInAttesa);
  assert.deepEqual(restored.inventarioMensaByEdificioId, initial.inventarioMensaByEdificioId);
  assert.deepEqual(restored.tipologieFamigliaAccettate, initial.tipologieFamigliaAccettate);
  assert.equal("mostraModalCostruisci" in restored, false);
  assert.equal("mapTransform" in restored, false);
  assert.equal("commuteByAbitanteId" in restored, false);
});
