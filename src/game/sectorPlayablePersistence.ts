import { createPlayableKingdom, isPlayableKingdom, PLAYABLE_SAVE_KEY, type PlayableKingdom } from "./sectorPlayableModel";

/** Only the sector key is ever read/written. Never call clear(), removeItem() or touch the main save. */
export type SectorSaveStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
};

export async function loadSectorKingdom(storage: SectorSaveStorage): Promise<{
  kingdom: PlayableKingdom;
  invalid: boolean;
}> {
  try {
    const raw = await storage.getItem(PLAYABLE_SAVE_KEY);
    if (raw === null) return { kingdom: createPlayableKingdom(), invalid: false };
    const parsed: unknown = JSON.parse(raw);
    if (isPlayableKingdom(parsed)) return { kingdom: parsed, invalid: false };
  } catch {
    // Preserve the original data: never overwrite a corrupted or unreadable save implicitly.
  }
  return { kingdom: createPlayableKingdom(), invalid: true };
}

/** Serialize asynchronous writes so a slow older write cannot overwrite a newer day/building. */
export function createSectorSaveQueue(storage: SectorSaveStorage) {
  let tail: Promise<void> = Promise.resolve();
  let latest: Promise<void> = tail;
  return {
    enqueue(kingdom: PlayableKingdom): Promise<void> {
      const snapshot = JSON.stringify(kingdom);
      latest = tail.then(async () => { await storage.setItem(PLAYABLE_SAVE_KEY, snapshot); });
      tail = latest.catch(() => { /* A failed write must not poison the queue. */ });
      return latest;
    },
    flush(): Promise<void> { return latest; }
  };
}
