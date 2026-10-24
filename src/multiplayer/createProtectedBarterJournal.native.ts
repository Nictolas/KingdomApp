import { Platform } from "react-native";
import { createGameSaveStorage } from "../persistence/createGameSaveStorage";
import { BarterJournalRepository } from "./barterJournal";

/**
 * Il journal usa la stessa chiave AES-256-GCM protetta dal sistema operativo
 * già in uso per i salvataggi nativi. La chiave non viene condivisa sui canali
 * P2P. Non creare journal sul web, dove lo storage non è protetto.
 *
 * Chiamare soltanto con saveId del salvataggio ATTIVO e già persistito.
 */
export async function createProtectedBarterJournal(saveId: string): Promise<BarterJournalRepository> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    throw new Error("Journal P2P protetto disponibile soltanto su Android e iPhone.");
  }
  const storage = await createGameSaveStorage();
  return new BarterJournalRepository(storage, saveId);
}
