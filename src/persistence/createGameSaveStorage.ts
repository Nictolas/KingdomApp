import { Platform } from "react-native";
import { createAsyncStoragePersistentStorage } from "./asyncStorageAdapter.ts";
import {
  EncryptedSaveStorage,
  hasProtectedSave,
  type SaveCipher
} from "./encryptedSaveStorage.ts";
import type { PersistentStorage } from "./storage.ts";
import { deserializeSave } from "./saveSerializer.ts";
import { ENCRYPTED_SAVE_PREFIX, ENCRYPTED_SAVE_SLOTS } from "./encryptedSaveStorage.ts";

const KEYCHAIN_ENTRY = "mykingdom.local-save.aes256gcm.key.v1";
const MIGRATED_ENTRY = "mykingdom.local-save.aes256gcm.migration.done.v1";
const AAD_VERSION = "mykingdom-save-slot:v1:";

/**
 * Android/iOS: AES-256-GCM protects ALL persisted save slots, including temp
 * and backup. The 256-bit key is protected by OS SecureStore (Keystore/Keychain)
 * instead of being embedded in the application or stored with the save.
 *
 * This neither prevents a modified client nor proves the economic state to
 * other P2P peers. Do not send the raw device key over WebRTC.
 */
export async function createGameSaveStorage(): Promise<PersistentStorage> {
  const raw = await createAsyncStoragePersistentStorage();
  // Legacy Expo web preview only. Multiplayer and protected saves are mobile-only.
  if (Platform.OS !== "android" && Platform.OS !== "ios") return raw;

  const [Crypto, SecureStore] = await Promise.all([
    import("expo-crypto"),
    import("expo-secure-store")
  ]);

  let keyHex = await SecureStore.getItemAsync(KEYCHAIN_ENTRY);
  const migrated = (await SecureStore.getItemAsync(MIGRATED_ENTRY)) === "yes";
  if (!keyHex) {
    if (migrated) throw new Error("Chiave di cifratura perduta: impossibile usare il salvataggio esistente.");
    if (await hasProtectedSave(raw)) {
      // Lost Keychain / Keystore entry: never create a replacement key or
      // silently reset a kingdom with data we can no longer decrypt.
      throw new Error(
        "Chiave di cifratura non disponibile per questo salvataggio. " +
        "Non iniziare una nuova partita prima di aver verificato il ripristino."
      );
    }
    const newKey = await Crypto.AESEncryptionKey.generate(256);
    keyHex = await newKey.encoded("hex");
    await SecureStore.setItemAsync(KEYCHAIN_ENTRY, keyHex, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
  }

  const key = await Crypto.AESEncryptionKey.import(keyHex, "hex");
  const utf8 = new TextEncoder();
  const decoder = new TextDecoder();
  const aad = (slot: string) => utf8.encode(AAD_VERSION + slot);

  const cipher: SaveCipher = {
    async encrypt(slot, plaintext) {
      const sealed = await Crypto.aesEncryptAsync(utf8.encode(plaintext), key, {
        additionalData: aad(slot)
      });
      const encoded = await sealed.combined("base64");
      if (typeof encoded !== "string") throw new Error("Formato cifratura inatteso.");
      return encoded;
    },
    async decrypt(slot, ciphertext) {
      try {
        const sealed = Crypto.AESSealedData.fromCombined(ciphertext);
        const plain = await Crypto.aesDecryptAsync(sealed, key, {
          additionalData: aad(slot),
          output: "bytes"
        });
        if (!(plain instanceof Uint8Array)) throw new Error("Dati decifrati non validi.");
        return decoder.decode(plain);
      } catch {
        throw new Error("Salvataggio cifrato illeggibile o manomesso.");
      }
    }
  };

  const storage = new EncryptedSaveStorage(raw, cipher);
  // Commit the migration marker in SecureStore rather than alongside mutable
  // save bytes: plain JSON must never be accepted as a post-migration save.
  if (!migrated) {
    await storage.migrateLegacySaves();
    await SecureStore.setItemAsync(MIGRATED_ENTRY, "yes", {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
  }

  const present = await Promise.all(ENCRYPTED_SAVE_SLOTS.map(slot => raw.getItem(slot)));
  if (present.some(value => value !== null && !value.startsWith(ENCRYPTED_SAVE_PREFIX))) {
    throw new Error("Rilevata alterazione del salvataggio: un archivio non è cifrato.");
  }

  // Never mistake three unreadable copies for a newly installed game.
  if (present.some(value => value !== null)) {
    let recoverable = false;
    for (const slot of ENCRYPTED_SAVE_SLOTS) {
      try {
        const value = await storage.getItem(slot);
        if (value !== null) {
          deserializeSave(value);
          recoverable = true;
          break;
        }
      } catch { /* Try the next slot. */ }
    }
    if (!recoverable) {
      throw new Error("Nessuna copia del salvataggio cifrato è leggibile. Non sovrascrivere i dati.");
    }
  }
  return storage;
}
