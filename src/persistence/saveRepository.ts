import { deserializeSave, serializeSave } from "./saveSerializer.ts";
import type { SaveEnvelopeV1 } from "./saveTypes.ts";
import type { PersistentStorage } from "./storage.ts";

export const SAVE_PRIMARY_KEY = "mykingdom.save.primary";
export const SAVE_BACKUP_KEY = "mykingdom.save.backup";
export const SAVE_TEMP_KEY = "mykingdom.save.temp";

export type LoadSaveResult =
  | { source: "primary"; save: SaveEnvelopeV1 }
  | { source: "temp"; save: SaveEnvelopeV1 }
  | { source: "backup"; save: SaveEnvelopeV1 }
  | { source: "none"; save: null };

export class SaveRepository {
  private readonly storage: PersistentStorage;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(storage: PersistentStorage) {
    this.storage = storage;
  }

  async loadPrimary(): Promise<SaveEnvelopeV1 | null> {
    return this.load(SAVE_PRIMARY_KEY);
  }

  async loadBackup(): Promise<SaveEnvelopeV1 | null> {
    return this.load(SAVE_BACKUP_KEY);
  }

  async loadTemp(): Promise<SaveEnvelopeV1 | null> {
    return this.load(SAVE_TEMP_KEY);
  }

  /** Non propaga errori di storage o validazione durante il bootstrap del gioco. */
  async loadBestAvailable(): Promise<LoadSaveResult> {
    const primary = await this.tryLoad(SAVE_PRIMARY_KEY);
    const backup = await this.tryLoad(SAVE_BACKUP_KEY);
    const temp = await this.tryLoad(SAVE_TEMP_KEY);

    // Un temp valido indica una scrittura interrotta. Lo recuperiamo soltanto se non
    // risulta più vecchio di nessun salvataggio stabile valido, così un residuo temp
    // obsoleto non può prevalere su primary/backup più recenti.
    if (
      temp &&
      (!primary || this.isAtLeastAsRecent(temp, primary)) &&
      (!backup || this.isAtLeastAsRecent(temp, backup))
    ) {
      return { source: "temp", save: temp };
    }
    if (primary) return { source: "primary", save: primary };
    if (backup) return { source: "backup", save: backup };
    if (temp) return { source: "temp", save: temp };

    return { source: "none", save: null };
  }

  private async tryLoad(key: string): Promise<SaveEnvelopeV1 | null> {
    try {
      return await this.load(key);
    } catch {
      return null;
    }
  }

  private isAtLeastAsRecent(candidate: SaveEnvelopeV1, reference: SaveEnvelopeV1): boolean {
    const candidateMs = Date.parse(candidate.metadata.updatedAt);
    const referenceMs = Date.parse(reference.metadata.updatedAt);
    if (Number.isFinite(candidateMs) && Number.isFinite(referenceMs)) return candidateMs >= referenceMs;
    if (Number.isFinite(candidateMs) && !Number.isFinite(referenceMs)) return true;
    return false;
  }

  private async load(key: string): Promise<SaveEnvelopeV1 | null> {
    const raw = await this.storage.getItem(key);
    return raw == null ? null : deserializeSave(raw);
  }

  save(envelope: SaveEnvelopeV1): Promise<void> {
    // Serializziamo subito per validare/catturare esattamente lo stato richiesto dal chiamante.
    const nextRaw = serializeSave(envelope);
    return this.enqueueMutation(() => this.saveSerialized(nextRaw));
  }

  private async saveSerialized(nextRaw: string): Promise<void> {
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

  clearAll(): Promise<void> {
    return this.enqueueMutation(async () => {
      await Promise.all([
        this.storage.removeItem(SAVE_PRIMARY_KEY),
        this.storage.removeItem(SAVE_BACKUP_KEY),
        this.storage.removeItem(SAVE_TEMP_KEY)
      ]);
    });
  }

  private enqueueMutation(operation: () => Promise<void>): Promise<void> {
    const run = this.mutationQueue.catch(() => undefined).then(operation);
    // Un errore deve essere visibile al chiamante ma non deve bloccare per sempre la coda.
    this.mutationQueue = run.catch(() => undefined);
    return run;
  }
}
