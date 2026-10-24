import { Platform } from "react-native";
import { createAsyncStoragePersistentStorage } from "./asyncStorageAdapter.ts";
import {
  EncryptedSaveStorage,
  hasProtectedSave,
  type SaveCipher
} from "./encryptedSaveStorage.ts";
import type { PersistentStorage } from "./storage.ts";

const KEYCHAIN_ENTRY = "mykingdom.local-save.aes256gcm.key.v1";
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
  if (!keyHex) {
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
  await storage.migrateLegacySaves();
  return storage;
}
