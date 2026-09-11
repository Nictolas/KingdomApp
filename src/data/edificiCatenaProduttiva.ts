/**
 * Catalogo catena produttiva edifici (pagina Menu → Edifici).
 * Ordine allineato alla tabella di design.
 *
 * Tipologia:
 * - Impresa = attività economica (compra/vende/trasforma, scheda Impresa)
 * - Servizio = struttura pubblica (cura, istruzione, culto, amministrazione)
 */

export type TipologiaEdificioCatena = "Impresa" | "Servizio";

export type EdificioCatenaInfo = {
  nome: string;
  emoji: string;
  tipologia: TipologiaEdificioCatena;
  richiede: string;
  lavoratore: string;
  produce: string;
  serveA: string;
};

export const EDIFICI_CATENA_PRODUTTIVA: EdificioCatenaInfo[] = [
  {
    nome: "Falegnameria",
    emoji: "🪚",
    tipologia: "Impresa",
    richiede: "🪵 Legno",
    lavoratore: "Falegname",
    produce: "🪑 Mobili / 🧱 Assi",
    serveA: "Abitanti, Costruttori"
  },
  {
    nome: "Conceria",
    emoji: "🧴",
    tipologia: "Impresa",
    richiede: "🐾 Pelli",
    lavoratore: "Conciatore",
    produce: "🟫 Cuoio",
    serveA: "Sarti, Calzolai, Armaioli"
  },
  {
    nome: "Sartoria",
    emoji: "👕",
    tipologia: "Impresa",
    richiede: "🟫 Cuoio / 🧶 Tessuto",
    lavoratore: "Sarto",
    produce: "👕 Vestiti",
    serveA: "Abitanti, Soldati"
  },
  {
    nome: "Spezieria",
    emoji: "⚗️",
    tipologia: "Impresa",
    richiede: "🌿 Erbe + 🍄 Funghi",
    lavoratore: "Speziale",
    produce: "🧪 Rimedi",
    serveA: "Medici della Peste, Abitanti"
  },
  {
    nome: "Cereria",
    emoji: "🕯️",
    tipologia: "Impresa",
    richiede: "🐝 Cera",
    lavoratore: "Ceraiolo",
    produce: "🕯️ Candele",
    serveA: "Abitanti, Chiese, Taverne"
  },
  {
    nome: "Forno",
    emoji: "🍞",
    tipologia: "Impresa",
    richiede: "🌾 Farina + 🪵 Legna",
    lavoratore: "Fornaio",
    produce: "🍞 Pane",
    serveA: "Abitanti, Taverna"
  },
  {
    nome: "Birrificio",
    emoji: "🍺",
    tipologia: "Impresa",
    richiede: "🌾 Cereali + 💧 Acqua",
    lavoratore: "Birraio",
    produce: "🍺 Birra",
    serveA: "Taverna, Abitanti"
  },
  {
    nome: "Armeria",
    emoji: "🏹",
    tipologia: "Impresa",
    richiede: "🪵 Legno + 🦌 Corna / 🟫 Cuoio",
    lavoratore: "Armaiolo",
    produce: "🏹 Archi, scudi",
    serveA: "Soldati, Cacciatori"
  },
  {
    nome: "Forgia",
    emoji: "🔨",
    tipologia: "Impresa",
    richiede: "⛏️ Minerale + 🪵 Carbone",
    lavoratore: "Fabbro",
    produce: "⚔️ Attrezzi / Armi",
    serveA: "Soldati, altri lavoratori"
  },
  {
    nome: "Emporio",
    emoji: "🧺",
    tipologia: "Impresa",
    richiede: "Risorse grezze e prodotti",
    lavoratore: "Mercante",
    produce: "Nessuna trasformazione",
    serveA: "Vende agli Abitanti"
  },
  {
    nome: "Taverna",
    emoji: "🍲",
    tipologia: "Impresa",
    richiede: "🥩 Carne + 🍄 Funghi + 🍺 Birra",
    lavoratore: "Oste / Cuoco",
    produce: "🍲 Pasti",
    serveA: "Abitanti, Viaggiatori"
  },
  {
    nome: "Lazzaretto",
    emoji: "🏥",
    tipologia: "Servizio",
    richiede: "🧪 Rimedi + 🩹 Tessuti",
    lavoratore: "Medico della Peste",
    produce: "❤️ Cure",
    serveA: "Abitanti malati"
  },
  {
    nome: "Scriptorium",
    emoji: "📜",
    tipologia: "Servizio",
    richiede: "📄 Carta + 🖋️ Inchiostro",
    lavoratore: "Scriba",
    produce: "📜 Libri / Documenti",
    serveA: "Scuola, Chiesa, Governo"
  },
  {
    nome: "Scuola",
    emoji: "📚",
    tipologia: "Servizio",
    richiede: "📜 Libri",
    lavoratore: "Maestro",
    produce: "🎓 Istruzione",
    serveA: "Bambini / nuovi lavoratori"
  },
  {
    nome: "Chiesa",
    emoji: "⛪",
    tipologia: "Servizio",
    richiede: "🕯️ Candele + 🍷 eventuali offerte",
    lavoratore: "Sacerdote",
    produce: "🙏 Fede / cerimonie",
    serveA: "Abitanti"
  },
  {
    nome: "Laboratorio Magico",
    emoji: "🧙",
    tipologia: "Impresa",
    richiede: "🌿 Erbe + 💎 Minerali + 🍄 Funghi",
    lavoratore: "Alchimista",
    produce: "✨ Pozioni / reagenti",
    serveA: "Maghi, Necromanti"
  },
  {
    nome: "Cripta Necromantica",
    emoji: "☠️",
    tipologia: "Impresa",
    richiede: "🦴 Ossa + ✨ Magia",
    lavoratore: "Necromante",
    produce: "💀 Scheletri",
    serveA: "Regno / lavori automatici"
  }
];
