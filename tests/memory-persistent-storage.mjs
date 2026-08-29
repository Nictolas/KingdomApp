export class MemoryPersistentStorage {
  values = new Map();
  failSetFor = new Set();
  failGetFor = new Set();
  corruptSetFor = new Map();

  async getItem(key) {
    if (this.failGetFor.has(key)) throw new Error(`Errore lettura simulato per ${key}`);
    return this.values.get(key) ?? null;
  }

  async setItem(key, value) {
    if (this.failSetFor.has(key)) throw new Error(`Errore simulato per ${key}`);
    this.values.set(key, this.corruptSetFor.get(key) ?? value);
  }

  async removeItem(key) {
    this.values.delete(key);
  }
}
