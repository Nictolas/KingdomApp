import type { BarterJournalRepository } from "./barterJournal";

/** Journal dei baratti disabilitato sulla demo web: cifratura non disponibile. */
export async function createProtectedBarterJournal(_saveId: string): Promise<BarterJournalRepository> {
  throw new Error("I baratti P2P richiedono l'app nativa Android o iPhone.");
}
