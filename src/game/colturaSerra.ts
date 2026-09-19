/** Colture vegetali selezionabili in ogni Serra. */
export type ColturaSerraDef = {
  id: string;
  nome: string;
  emoji: string;
};

export const COLTURE_SERRA: ColturaSerraDef[] = [
  { id: "mela", nome: "Mela", emoji: "🍎" },
  { id: "pera", nome: "Pera", emoji: "🍐" },
  { id: "mandarino", nome: "Mandarino", emoji: "🍊" },
  { id: "limone", nome: "Limone", emoji: "🍋" },
  { id: "banana", nome: "Banana", emoji: "🍌" },
  { id: "anguria", nome: "Anguria", emoji: "🍉" },
  { id: "uva", nome: "Uva", emoji: "🍇" },
  { id: "fragola", nome: "Fragola", emoji: "🍓" },
  { id: "melone", nome: "Melone", emoji: "🍈" },
  { id: "ciliegia", nome: "Ciliegia", emoji: "🍒" },
  { id: "pesca", nome: "Pesca", emoji: "🍑" },
  { id: "mango", nome: "Mango", emoji: "🥭" },
  { id: "ananas", nome: "Ananas", emoji: "🍍" },
  { id: "cocco", nome: "Cocco", emoji: "🥥" },
  { id: "kiwi", nome: "Kiwi", emoji: "🥝" },
  { id: "pomodoro", nome: "Pomodoro", emoji: "🍅" },
  { id: "avocado", nome: "Avocado", emoji: "🥑" },
  { id: "melanzana", nome: "Melanzana", emoji: "🍆" },
  { id: "patata", nome: "Patata", emoji: "🥔" },
  { id: "carota", nome: "Carota", emoji: "🥕" },
  { id: "pannocchia", nome: "Pannocchia", emoji: "🌽" },
  { id: "peperoncino", nome: "Peperoncino", emoji: "🌶️" },
  { id: "verdura_foglia", nome: "Verdura a foglia", emoji: "🥬" },
  { id: "broccoli", nome: "Broccoli", emoji: "🥦" },
  { id: "aglio", nome: "Aglio", emoji: "🧄" },
  { id: "cipolla", nome: "Cipolla", emoji: "🧅" },
  { id: "fungo", nome: "Fungo", emoji: "🍄" },
  { id: "arachidi", nome: "Arachidi", emoji: "🥜" },
  { id: "cetriolo", nome: "Cetriolo", emoji: "🥒" },
  { id: "patata_dolce", nome: "Patata dolce", emoji: "🍠" },
  { id: "grano", nome: "Grano", emoji: "🌾" },
  { id: "riso", nome: "Riso", emoji: "🍚" }
];

export const COLTURA_SERRA_DEFAULT = "mela";

export const COLTURE_SERRA_IDS = COLTURE_SERRA.map((c) => c.id);

/** Produzione base: 1 unità al giorno per ogni Serra operativa con coltura impostata. */
export const PRODUZIONE_SERRA_GIORNALIERA = 1;

/** Giorni simulati per ogni Skip Mese (produzione Serra). */
export const GIORNI_PRODUZIONE_SERRA_PER_MESE = 30;

export function isColturaSerraValida(itemId: string): boolean {
  return COLTURE_SERRA_IDS.includes(itemId);
}

export function getColturaSerraDef(itemId: string | undefined): ColturaSerraDef | undefined {
  const id = itemId && isColturaSerraValida(itemId) ? itemId : COLTURA_SERRA_DEFAULT;
  return COLTURE_SERRA.find((c) => c.id === id);
}


/** Colture selezionabili: in Creativa tutte; in Avventura solo quelle sbloccate. */
export function getColtureSerraDisponibili(
  sbloccate: readonly string[] | undefined,
  modalitaGioco: "creativa" | "avventura"
): ColturaSerraDef[] {
  if (modalitaGioco === "creativa") return COLTURE_SERRA;
  const set = new Set((sbloccate ?? []).filter((id) => isColturaSerraValida(id)));
  if (set.size === 0) {
    const fallback = getColturaSerraDef(COLTURA_SERRA_DEFAULT)!;
    return [fallback];
  }
  return COLTURE_SERRA.filter((c) => set.has(c.id));
}

export function tutteColtureSerraSbloccate(): string[] {
  return [...COLTURE_SERRA_IDS];
}

/** Normalizza lo stato sblocchi Serra mantenendo compatibilità con i vecchi salvataggi. */
export function normalizzaColtureSerraSbloccate(opts: {
  sbloccate: unknown;
  modalitaGioco: "creativa" | "avventura";
  obiettiviCompletati?: readonly string[];
  colturaSerraCorrente?: string;
}): string[] {
  if (opts.modalitaGioco === "creativa") return tutteColtureSerraSbloccate();
  if (opts.obiettiviCompletati?.includes("raccolto_serra")) return tutteColtureSerraSbloccate();

  const raw = Array.isArray(opts.sbloccate)
    ? opts.sbloccate.filter((id): id is string => typeof id === "string" && isColturaSerraValida(id))
    : [];
  if (raw.length > 0) return [...new Set(raw)];

  const fallback =
    opts.colturaSerraCorrente && isColturaSerraValida(opts.colturaSerraCorrente)
      ? opts.colturaSerraCorrente
      : COLTURA_SERRA_DEFAULT;
  return [fallback];
}
