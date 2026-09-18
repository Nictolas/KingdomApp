/**
 * Lavori di raccolta: occupazione → oggetto del catalogo naturale.
 * Nomi univoci (disambiguati se coincidono con mestieri già presenti).
 */

export type LavoroRaccoltaDef = {
  /** Nome canonico dell’occupazione. */
  lavoro: string;
  emoji: string;
  /** Cosa raccoglie / produce (testo UI, allineato a Oggetti). */
  produce: string;
  /** Emoji dell’oggetto prodotto (se diversa dal lavoro). */
  produceEmoji?: string;
};

/**
 * Elenco in ordine di design.
 * - Taglialegna: mestiere già in catalogo → solo mapping produzione.
 * - Speziale craft (Spezieria) ≠ «Erborista medico» (erbe medicinali).
 * - Due voci «Cacciatore» nella tabella: disambiguate in Cacciatore / Cacciatore di corna.
 */
export const LAVORI_RACCOLTA: LavoroRaccoltaDef[] = [
  { lavoro: "Cercatore di Funghi", emoji: "🍄", produce: "Funghi" },
  { lavoro: "Raccoglitore di Bacche", emoji: "🫐", produce: "Bacche" },
  { lavoro: "Fruttaiolo", emoji: "🍎", produce: "Frutta selvatica" },
  { lavoro: "Castagnaro", emoji: "🌰", produce: "Castagne e noci" },
  { lavoro: "Erborista", emoji: "🌿", produce: "Erbe" },
  { lavoro: "Erborista medico", emoji: "🌱", produce: "Erbe medicinali" },
  { lavoro: "Taglialegna", emoji: "🪵", produce: "Legno" },
  { lavoro: "Resinaio", emoji: "🌲", produce: "Resina" },
  { lavoro: "Fioraio", emoji: "🌼", produce: "Fiori" },
  { lavoro: "Apicoltore", emoji: "🍯", produce: "Miele e cera" },
  { lavoro: "Cacciatore", emoji: "🐇", produce: "Piccoli animali" },
  { lavoro: "Cacciatore di selvaggina", emoji: "🦌", produce: "Selvaggina" },
  { lavoro: "Uccellatore", emoji: "🪶", produce: "Piume" },
  { lavoro: "Scarnificatore", emoji: "🦴", produce: "Ossa" },
  { lavoro: "Cacciatore di corna", emoji: "🦌", produce: "Corna" },
  { lavoro: "Pellicciaio", emoji: "🐾", produce: "Pelli e pellicce" },
  { lavoro: "Raccoglitore di uova", emoji: "🥚", produce: "Uova selvatiche" },
  { lavoro: "Raccoglitore di semi", emoji: "🌾", produce: "Semi" },
  { lavoro: "Cavatore", emoji: "🪨", produce: "Pietre" },
  { lavoro: "Prospettore", emoji: "💎", produce: "Minerali rari" },
  { lavoro: "Raccoglitore di seta", emoji: "🕸️", produce: "Ragnatele" },
  { lavoro: "Lumacaro", emoji: "🐌", produce: "Lumache" },
  { lavoro: "Entomologo", emoji: "🐛", produce: "Insetti" },
  { lavoro: "Raccoglitore di rami", emoji: "🌳", produce: "Rami" }
];

const BY_LAVORO = new Map(LAVORI_RACCOLTA.map((v) => [v.lavoro, v]));

export function lavoroRaccoltaPerNome(lavoro: string): LavoroRaccoltaDef | undefined {
  return BY_LAVORO.get(lavoro);
}

/** Etichetta UI: cosa raccoglie questo lavoro. */
export function etichettaProduceRaccolta(lavoro: string): string | null {
  const v = BY_LAVORO.get(lavoro);
  if (!v) return null;
  const emoji = v.produceEmoji ?? v.emoji;
  return `${emoji} ${v.produce}`;
}
