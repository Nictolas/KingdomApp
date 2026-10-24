import type { BarterJournalRepository } from "./barterJournal";

/** Metro sceglie la versione nativa Android/iOS o il blocco web. */
export declare function createProtectedBarterJournal(saveId: string): Promise<BarterJournalRepository>;
