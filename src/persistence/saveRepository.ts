import { deserializeSave, serializeSave } from "./saveSerializer.ts";
import type { SaveEnvelopeV1 } from "./saveTypes.ts";
import type { PersistentStorage } from "./storage.ts";

export const SAVE_PRIMARY_KEY = "mykingdom.save.primary";
export const SAVE_BACKUP_KEY = "mykingdom.save.backup";
export const SAVE_TEMP_KEY = "mykingdom.save.temp";

export type LoadSaveResult =
  | { source: "primary"; save: SaveEnvelopeV1 }
  | { source: "backup"; save: SaveEnvelopeV1 }
  | { source: "none"; save: null };

export class SaveRepository {
  private readonly storage: PersistentStorage;

  constructor(storage: PersistentStorage) {
    this.storage = storage;
  }

  async loadPrimary(): Promise<SaveEnvelopeV1 | null> {
    return this.load(SAVE_PRIMARY_KEY);
  }

  async loadBackup(): Promise<SaveEnvelopeV1 | null> {
    return this.load(SAVE_BACKUP_KEY);
  }

  /** Non propaga errori di storage o validazione durante il bootstrap del gioco. */
  async loadBestAvailable(): Promise<LoadSaveResult> {
    try {
      const primary = await this.loadPrimary();
      if (primary) return { source: "primary", save: primary };
    } catch {
      // Il fallback sul backup è intenzionale anche per errori del driver.
    }
    try {
      const backup = await this.loadBackup();
      if (backup) return { source: "backup", save: backup };
    } catch {
      // Il chiamante riceve un risultato esplicito anziché un crash.
    }
    return { source: "none", save: null };
  }

  private async load(key: string): Promise<SaveEnvelopeV1 | null> {
    const raw = await this.storage.getItem(key);
    return raw == null ? null : deserializeSave(raw);
  }

  async save(envelope: SaveEnvelopeV1): Promise<void> {
    const nextRaw = serializeSave(envelope);

    await this.storage.setItem(SAVE_TEMP_KEY, nextRaw);
    const tempRaw = await this.storage.getItem(SAVE_TEMP_KEY);
    if (tempRaw == null) throw new Error("Scrittura temporanea non riuscita.");
    deserializeSave(tempRaw);

    const oldPrimary = await this.storage.getItem(SAVE_PRIMARY_KEY);
    if (oldPrimary != null) {
      try {
        deserializeSave(oldPrimary);
        await this.storage.setItem(SAVE_BACKUP_KEY, oldPrimary);
      } catch {
        // Un primary corrotto non deve mai sostituire un backup valido.
      }
    }

    await this.storage.setItem(SAVE_PRIMARY_KEY, tempRaw);
    const writtenPrimary = await this.storage.getItem(SAVE_PRIMARY_KEY);
    if (writtenPrimary == null) throw new Error("Scrittura del salvataggio principale non riuscita.");
    deserializeSave(writtenPrimary);
    await this.storage.removeItem(SAVE_TEMP_KEY);
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      this.storage.removeItem(SAVE_PRIMARY_KEY),
      this.storage.removeItem(SAVE_BACKUP_KEY),
      this.storage.removeItem(SAVE_TEMP_KEY)
    ]);
  }
}
