import assert from "node:assert/strict";
import test from "node:test";

import { AsyncStoragePersistentStorage } from "../src/persistence/asyncStorageAdapter.ts";
import { gameSaveV1ToGameState, gameStateToGameSaveV1 } from "../src/persistence/gameStateMapping.ts";
import { SaveRepository, SAVE_BACKUP_KEY, SAVE_PRIMARY_KEY } from "../src/persistence/saveRepository.ts";
import { serializeSave } from "../src/persistence/saveSerializer.ts";
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
  const result = await new SaveRepository(storage).loadBestAvailable();
  assert.deepEqual(result, { source: "none", save: null });
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
