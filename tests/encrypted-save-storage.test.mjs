import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import test from "node:test";

import {
  ENCRYPTED_SAVE_PREFIX,
  ENCRYPTED_SAVE_SLOTS,
  EncryptedSaveStorage,
  hasProtectedSave
} from "../src/persistence/encryptedSaveStorage.ts";
import { MemoryPersistentStorage } from "./memory-persistent-storage.mjs";

function nodeGcmCipher() {
  const key = randomBytes(32);
  return {
    async encrypt(slot, plaintext) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(Buffer.from("mykingdom-save-slot:v1:" + slot, "utf8"));
      const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final()
      ]);
      return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString("base64");
    },
    async decrypt(slot, sealed) {
      const data = Buffer.from(sealed, "base64");
      const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
      decipher.setAAD(Buffer.from("mykingdom-save-slot:v1:" + slot, "utf8"));
      decipher.setAuthTag(data.subarray(-16));
      return Buffer.concat([
        decipher.update(data.subarray(12, -16)),
        decipher.final()
      ]).toString("utf8");
    }
  };
}

test("salvataggi: il testo originale non è scritto in chiaro", async () => {
  const raw = new MemoryPersistentStorage();
  const secure = new EncryptedSaveStorage(raw, nodeGcmCipher());
  const text = '{"personaggio":"Rè ⚔️","ferro":100000}';
  const key = ENCRYPTED_SAVE_SLOTS[0];

  await secure.setItem(key, text);
  const persisted = await raw.getItem(key);
  assert.ok(persisted.startsWith(ENCRYPTED_SAVE_PREFIX));
  assert.ok(!persisted.includes("personaggio"));
  assert.equal(await secure.getItem(key), text);
});

test("salvataggi: la stessa versione produce ciphertext differenti", async () => {
  const raw = new MemoryPersistentStorage();
  const secure = new EncryptedSaveStorage(raw, nodeGcmCipher());
  const slot = ENCRYPTED_SAVE_SLOTS[0];
  await secure.setItem(slot, "identico");
  const a = await raw.getItem(slot);
  await secure.setItem(slot, "identico");
  const b = await raw.getItem(slot);
  assert.notEqual(a, b);
});

test("salvataggi: la manipolazione dei byte viene rilevata", async () => {
  const raw = new MemoryPersistentStorage();
  const secure = new EncryptedSaveStorage(raw, nodeGcmCipher());
  const slot = ENCRYPTED_SAVE_SLOTS[0];
  await secure.setItem(slot, '{"valid":true}');
  const encrypted = await raw.getItem(slot);
  const data = Buffer.from(encrypted.slice(ENCRYPTED_SAVE_PREFIX.length), "base64");
  data[15] ^= 0x10;
  await raw.setItem(slot, ENCRYPTED_SAVE_PREFIX + data.toString("base64"));
  await assert.rejects(() => secure.getItem(slot));
});

test("salvataggi: primary e backup hanno AAD diversi", async () => {
  const raw = new MemoryPersistentStorage();
  const secure = new EncryptedSaveStorage(raw, nodeGcmCipher());
  await secure.setItem(ENCRYPTED_SAVE_SLOTS[0], "regno");
  await raw.setItem(ENCRYPTED_SAVE_SLOTS[1], await raw.getItem(ENCRYPTED_SAVE_SLOTS[0]));
  await assert.rejects(() => secure.getItem(ENCRYPTED_SAVE_SLOTS[1]));
});

test("salvataggi: migrazione legacy ripetibile senza perdita di backup", async () => {
  const raw = new MemoryPersistentStorage();
  const secure = new EncryptedSaveStorage(raw, nodeGcmCipher());
  await raw.setItem(ENCRYPTED_SAVE_SLOTS[0], '{"primary":1}');
  await raw.setItem(ENCRYPTED_SAVE_SLOTS[1], '{"backup":2}');
  await secure.migrateLegacySaves();
  const first = await raw.getItem(ENCRYPTED_SAVE_SLOTS[0]);
  assert.ok(first.startsWith(ENCRYPTED_SAVE_PREFIX));
  assert.equal(await secure.getItem(ENCRYPTED_SAVE_SLOTS[1]), '{"backup":2}');
  await secure.migrateLegacySaves();
  assert.equal(await raw.getItem(ENCRYPTED_SAVE_SLOTS[0]), first);
});

test("salvataggi: si riconoscono dati già cifrati prima di generare una nuova chiave", async () => {
  const raw = new MemoryPersistentStorage();
  assert.equal(await hasProtectedSave(raw), false);
  await raw.setItem(ENCRYPTED_SAVE_SLOTS[0], ENCRYPTED_SAVE_PREFIX + "abc");
  assert.equal(await hasProtectedSave(raw), true);
});

test("salvataggi: nessuna retrocompatibilità in chiaro per formati futuri sconosciuti", async () => {
  const raw = new MemoryPersistentStorage();
  const secure = new EncryptedSaveStorage(raw, nodeGcmCipher());
  const key = ENCRYPTED_SAVE_SLOTS[0];
  await raw.setItem(key, "mk:aes256gcm:v99:abc");
  await assert.rejects(() => secure.getItem(key), /non supportata/);
  await assert.rejects(() => secure.migrateLegacySaves(), /non supportat[oa]/);
});

test("salvataggi: dopo la migrazione un JSON in chiaro non viene mai accettato", async () => {
  const raw = new MemoryPersistentStorage();
  const secure = new EncryptedSaveStorage(raw, nodeGcmCipher());
  const slot = ENCRYPTED_SAVE_SLOTS[0];
  await raw.setItem(slot, '{"ferro":99999999}');
  await assert.rejects(() => secure.getItem(slot), /non cifrato/);
  await secure.migrateLegacySaves();
  assert.equal(await secure.getItem(slot), '{"ferro":99999999}');
  // Una nuova sostituzione in chiaro va rifiutata, non migrata in runtime.
  await raw.setItem(slot, '{"ferro":123}');
  await assert.rejects(() => secure.getItem(slot), /non cifrato/);
});
