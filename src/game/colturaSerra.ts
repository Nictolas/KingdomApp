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
