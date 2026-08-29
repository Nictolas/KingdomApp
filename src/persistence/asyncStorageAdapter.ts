import type { PersistentStorage } from "./storage.ts";

export type AsyncStorageDriver = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** Adapter sottile e iniettabile: nei test non richiede il modulo nativo Expo. */
export class AsyncStoragePersistentStorage implements PersistentStorage {
  private readonly driver: AsyncStorageDriver;

  constructor(driver: AsyncStorageDriver) {
    this.driver = driver;
  }

  getItem(key: string): Promise<string | null> {
    return this.driver.getItem(key);
  }

  setItem(key: string, value: string): Promise<void> {
    return this.driver.setItem(key, value);
  }

  removeItem(key: string): Promise<void> {
    return this.driver.removeItem(key);
  }
}

/**
 * Crea l'adapter reale per Expo/React Native/web. Il caricamento dinamico mantiene
 * il nucleo testabile senza inizializzare storage nativi durante i test Node.
 */
export async function createAsyncStoragePersistentStorage(): Promise<PersistentStorage> {
  const module = await import("@react-native-async-storage/async-storage");
  return new AsyncStoragePersistentStorage(module.default);
}
