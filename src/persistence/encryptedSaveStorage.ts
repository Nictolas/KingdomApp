import type { PersistentStorage } from "./storage.ts";

/**
 * Versioned, authenticated storage envelope for the three SaveRepository slots.
 * The backing cipher MUST use an authenticated algorithm (AES-256-GCM).
 * A different AAD is used per slot, so a ciphertext copied between slots fails.
 * This is protection against casual edits, NOT anti-rollback / server authority.
 */
/** A single corrupt/unsupported slot (as opposed to storage I/O failure). */
export class EncryptedSaveDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptedSaveDataError";
  }
}

export const ENCRYPTED_SAVE_PREFIX = "mk:aes256gcm:v1:";

export const ENCRYPTED_SAVE_SLOTS = [
  "mykingdom.save.primary",
  "mykingdom.save.backup",
  "mykingdom.save.temp"
] as const;

export interface SaveCipher {
  encrypt(slot: string, plaintext: string): Promise<string>;
  decrypt(slot: string, ciphertext: string): Promise<string>;
}

/** Distinguish a lost decryption key from an ordinary first-time installation. */
export async function hasProtectedSave(storage: PersistentStorage): Promise<boolean> {
  for (const slot of ENCRYPTED_SAVE_SLOTS) {
    const raw = await storage.getItem(slot);
    if (raw !== null && raw.startsWith("mk:")) return true;
  }
  return false;
}

export class EncryptedSaveStorage implements PersistentStorage {
  constructor(private readonly raw: PersistentStorage, private readonly cipher: SaveCipher) {}

  async getItem(slot: string): Promise<string | null> {
    const raw = await this.raw.getItem(slot);
    if (raw === null) return null;
    if (raw.startsWith(ENCRYPTED_SAVE_PREFIX)) {
      try {
        return await this.cipher.decrypt(slot, raw.slice(ENCRYPTED_SAVE_PREFIX.length));
      } catch {
        throw new EncryptedSaveDataError("Salvataggio cifrato illeggibile o manomesso.");
      }
    }
    if (raw.startsWith("mk:")) {
      throw new EncryptedSaveDataError("Versione del formato cifrato non supportata.");
    }
    // A plaintext value is never an acceptable loaded save after migration.
    // Legacy values are handled only by migrateLegacySaves(), before gameplay.
    throw new EncryptedSaveDataError("Salvataggio non cifrato rilevato dopo la migrazione.");
  }

  async setItem(slot: string, plaintext: string): Promise<void> {
    const ciphertext = await this.cipher.encrypt(slot, plaintext);
    await this.raw.setItem(slot, ENCRYPTED_SAVE_PREFIX + ciphertext);
  }

  removeItem(slot: string): Promise<void> {
    return this.raw.removeItem(slot);
  }

  /**
   * Encrypt old saves in place before gameplay starts; never delete a plaintext
   * slot until its encrypted replacement has been written and read successfully.
   * Re-running this after an interrupted migration is safe.
   */
  async migrateLegacySaves(): Promise<void> {
    for (const slot of ENCRYPTED_SAVE_SLOTS) {
      const raw = await this.raw.getItem(slot);
      if (raw == null || raw.startsWith(ENCRYPTED_SAVE_PREFIX)) continue;
      if (raw.startsWith("mk:")) throw new Error("Salvataggio cifrato con versione non supportata.");
      await this.setItem(slot, raw);
      const restored = await this.getItem(slot);
      if (restored !== raw) throw new Error("Verifica del salvataggio cifrato non riuscita.");
    }
  }
}
