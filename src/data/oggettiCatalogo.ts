/**
 * Catalogo oggetti (Menu → Oggetti) con valore di mercato in monete.
 * Prezzi allineati alla tabella economia raccolta / craft.
 */

export type TipologiaOggetto =
  | "Cibo vegetale"
  | "Cibo animale"
  | "Valuta"
  | "Materiale"
  | "Artigianato"
  | "Equipaggiamento"
  | "Magia"
  | "Altro";

export type OggettoCatalogoDef = {
  id: string;
  nome: string;
  emoji: string;
  tipologia: TipologiaOggetto;
  /** Prezzo base in monete. */
  valore: number;
  /** Se true, in UI si mostra «50+» (oggetti rari / magici). */
  valoreAperto?: boolean;
};

function slugify(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const RAW: {
  emoji: string;
  nome: string;
  tipologia: TipologiaOggetto;
  valore: number;
  valoreAperto?: boolean;
}[] = [
  { emoji: "🪙", nome: "Moneta", tipologia: "Valuta", valore: 1 },
  { emoji: "🌿", nome: "Erbe", tipologia: "Cibo vegetale", valore: 1 },
  { emoji: "🫐", nome: "Bacche", tipologia: "Cibo vegetale", valore: 1 },
  { emoji: "🍄", nome: "Funghi", tipologia: "Cibo vegetale", valore: 1 },
  { emoji: "🌼", nome: "Fiori", tipologia: "Cibo vegetale", valore: 1 },
  { emoji: "🌰", nome: "Castagne e noci", tipologia: "Cibo vegetale", valore: 1 },
  { emoji: "🌾", nome: "Semi", tipologia: "Cibo vegetale", valore: 1 },
  { emoji: "🌿", nome: "Foglie ed erbe aromatiche", tipologia: "Cibo vegetale", valore: 1 },
  { emoji: "🌳", nome: "Rami", tipologia: "Materiale", valore: 1 },
  { emoji: "🪵", nome: "Legno", tipologia: "Materiale", valore: 2 },
  { emoji: "🥚", nome: "Uova selvatiche", tipologia: "Cibo animale", valore: 2 },
  { emoji: "🪺", nome: "Nidi", tipologia: "Materiale", valore: 2 },
  { emoji: "🐌", nome: "Lumache", tipologia: "Cibo animale", valore: 2 },
  { emoji: "🐛", nome: "Insetti", tipologia: "Cibo animale", valore: 2 },
  { emoji: "🍎", nome: "Frutta selvatica", tipologia: "Cibo vegetale", valore: 2 },
  { emoji: "🍯", nome: "Miele", tipologia: "Cibo animale", valore: 3 },
  { emoji: "🌲", nome: "Resina", tipologia: "Materiale", valore: 3 },
  { emoji: "🪶", nome: "Piume", tipologia: "Materiale", valore: 3 },
  { emoji: "🦴", nome: "Ossa", tipologia: "Materiale", valore: 3 },
  { emoji: "🐇", nome: "Piccoli animali", tipologia: "Cibo animale", valore: 4 },
  { emoji: "🦌", nome: "Selvaggina", tipologia: "Cibo animale", valore: 4 },
  { emoji: "🦌", nome: "Corna", tipologia: "Materiale", valore: 4 },
  { emoji: "🐾", nome: "Pelli e pellicce", tipologia: "Materiale", valore: 4 },
  { emoji: "🪨", nome: "Pietre", tipologia: "Materiale", valore: 5 },
  { emoji: "⛏️", nome: "Metallo grezzo", tipologia: "Materiale", valore: 6 },
  { emoji: "🟫", nome: "Carbone", tipologia: "Materiale", valore: 4 },
  { emoji: "💎", nome: "Minerali rari", tipologia: "Materiale", valore: 12 },
  { emoji: "🌱", nome: "Erbe medicinali", tipologia: "Cibo vegetale", valore: 6 },
  { emoji: "🕸️", nome: "Ragnatele", tipologia: "Materiale", valore: 3 },
  { emoji: "🐝", nome: "Cera", tipologia: "Materiale", valore: 6 },
  { emoji: "🧱", nome: "Assi di legno", tipologia: "Materiale", valore: 6 },
  { emoji: "🟫", nome: "Cuoio", tipologia: "Materiale", valore: 7 },
  { emoji: "🌾", nome: "Farina", tipologia: "Cibo vegetale", valore: 8 },
  { emoji: "🧶", nome: "Tessuto", tipologia: "Materiale", valore: 8 },
  { emoji: "🍞", nome: "Pane", tipologia: "Cibo vegetale", valore: 10 },
  { emoji: "🕯️", nome: "Candela", tipologia: "Artigianato", valore: 10 },
  { emoji: "🍺", nome: "Birra", tipologia: "Cibo vegetale", valore: 12 },
  { emoji: "🪑", nome: "Mobile semplice", tipologia: "Artigianato", valore: 12 },
  { emoji: "👕", nome: "Vestito", tipologia: "Artigianato", valore: 14 },
  { emoji: "🧪", nome: "Rimedio", tipologia: "Altro", valore: 15 },
  { emoji: "🍲", nome: "Pasto", tipologia: "Altro", valore: 16 },
  { emoji: "🛠️", nome: "Attrezzo", tipologia: "Equipaggiamento", valore: 18 },
  { emoji: "🏹", nome: "Arco", tipologia: "Equipaggiamento", valore: 20 },
  { emoji: "🛡️", nome: "Scudo", tipologia: "Equipaggiamento", valore: 22 },
  { emoji: "⚔️", nome: "Arma", tipologia: "Equipaggiamento", valore: 25 },
  { emoji: "📜", nome: "Libro / manoscritto", tipologia: "Altro", valore: 30 },
  { emoji: "🧪", nome: "Pozione", tipologia: "Magia", valore: 35 },
  { emoji: "✨", nome: "Reagente magico", tipologia: "Magia", valore: 40 },
  { emoji: "💎", nome: "Oggetto raro / magico", tipologia: "Magia", valore: 50, valoreAperto: true }
];

export function formatValoreOggetto(o: Pick<OggettoCatalogoDef, "valore" | "valoreAperto">): string {
  return o.valoreAperto ? `${o.valore}+` : String(o.valore);
}

export const OGGETTI_CATALOGO: OggettoCatalogoDef[] = RAW.map((o) => ({
  id: slugify(o.nome),
  nome: o.nome,
  emoji: o.emoji,
  tipologia: o.tipologia,
  valore: o.valore,
  ...(o.valoreAperto ? { valoreAperto: true } : {})
}));
