/** Sezioni del catalogo Costruisci sulla mappa (ordine di visualizzazione). */
export const SEZIONI_COSTRUZIONE: { titolo: string; nomi: string[] }[] = [
  {
    titolo: "Ordine",
    nomi: ["Ufficio Edile", "Tribunale", "Campo di Lavoro", "Campo di Sterminio", "Centrale", "Caserma"]
  },
  {
    titolo: "Foresta",
    nomi: ["Capanna del Cacciatore", "Campo dei Taglialegna", "Capanno del Guardaboschi", "Erboristeria", "Apiario", "Vivaio forestale"]
  }
];

export type TerrenoCostruzioneKind = "acqua" | "spiaggia" | "erba";

/** Terreni piazzabili 2×2 — sezione Ambiente nel menu Costruisci. */
export const SEZIONE_AMBIENTE: {
  titolo: string;
  opzioni: { kind: TerrenoCostruzioneKind; emoji: string; nome: string }[];
} = {
  titolo: "Ambiente",
  opzioni: [
    { kind: "acqua", emoji: "🌊", nome: "Acqua" },
    { kind: "spiaggia", emoji: "🏖️", nome: "Spiaggia" },
    { kind: "erba", emoji: "🌿", nome: "Erba" }
  ]
};
