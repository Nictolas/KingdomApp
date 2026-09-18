/**
 * Catalogo imprese: attività economiche con scheda UI standard.
 * I tipi tematici (Svago, Commercio, Industria) restano su Edificio.tipo.
 */

export type ImpresaVoceMerce = {
  itemId?: string;
  etichetta: string;
};

export type ImpresaDef = {
  nomeEdificio: string;
  ruoloLavoratore: string;
  haClienti: boolean;
  /** Default "Clienti". */
  etichettaClienti?: string;
  hintClienti?: string;
  hintLavoratori?: string;
  produce: ImpresaVoceMerce[];
  compra: ImpresaVoceMerce[];
};

export const IMPRESE_CATALOGO: ImpresaDef[] = [
  {
    nomeEdificio: "Bar",
    ruoloLavoratore: "Barista",
    haClienti: true,
    etichettaClienti: "Clienti",
    hintClienti: "Di giorno, fuori orario di lavoro, sudditi in visita; di notte sono a casa.",
    hintLavoratori:
      "Se non c’è nessun Barista, il primo Disoccupato o Raccoglitore che entra diventa lavoratore. Altrimenti i disoccupati si assumono da soli; puoi assegnare Servi della gleba.",
    produce: [{ etichetta: "🍺 Birra (scorte infinite)" }],
    compra: [{ etichetta: "1 moneta per Birra → +10 Divertimento e Socialità" }]
  },
  {
    nomeEdificio: "Emporio",
    ruoloLavoratore: "Mercante",
    haClienti: true,
    etichettaClienti: "Clienti",
    hintClienti:
      "Chi è dentro l’Emporio ora: Raccoglitori che vendono cibo e disoccupati in cerca di lavoro (se non assunti).",
    hintLavoratori:
      "Disoccupati possono essere assunti come Mercanti (max 4). I Mercanti con monete comprano alimenti dai Raccoglitori.",
    produce: [{ etichetta: "Rivende merci / alimenti in scorta" }],
    compra: [{ etichetta: "Alimenti dai Raccoglitori (1 moneta cad.)" }]
  },
  {
    nomeEdificio: "Fucina",
    ruoloLavoratore: "Fabbro",
    haClienti: false,
    hintLavoratori: "Puoi assegnare Servi della gleba come Fabbri.",
    produce: [
      { etichetta: "⚔️ Attrezzi" },
      { etichetta: "🔩 Metallo lavorato" }
    ],
    compra: [
      { etichetta: "🪵 Carbone" },
      { etichetta: "⛏️ Metalli" }
    ]
  },
  {
    nomeEdificio: "Bosco",
    ruoloLavoratore: "Raccoglitore",
    haClienti: false,
    hintLavoratori:
      "Non ha proprietario. I disoccupati possono entrarvi da soli e diventare Raccoglitori. Verde = nel Bosco ora; sulla scheda vedi l’ultimo bottino.",
    produce: [
      { etichetta: "🍄 Funghi" },
      { etichetta: "🫐 Bacche" },
      { etichetta: "🌿 Erbe" },
      { etichetta: "🪵 Legno" },
      { etichetta: "🦌 Selvaggina" },
      { etichetta: "💎 Minerali rari" }
    ],
    compra: [{ etichetta: "Nessun acquisto: raccolta spontanea" }]
  },
  {
    nomeEdificio: "Miniera",
    ruoloLavoratore: "Minatore",
    haClienti: false,
    hintLavoratori:
      "Come il Bosco: i disoccupati vi entrano da soli e diventano Minatori. Verde = in Miniera ora. Bottino personale + 1 pezzo d’oro (Metalli)/giorno al regno. Stipendio dal Tesoro (voce Bilancio).",
    produce: [
      { etichetta: "⛏️ Metallo grezzo" },
      { etichetta: "🪨 Pietre" },
      { etichetta: "💎 Minerali rari" },
      { etichetta: "🟫 Carbone" },
      { etichetta: "🥇 1 pezzo d’oro → magazzino Metalli / giorno" }
    ],
    compra: [{ etichetta: "Nessun acquisto: estrazione" }]
  },
  {
    nomeEdificio: "Serra",
    ruoloLavoratore: "Agricoltore",
    haClienti: false,
    hintLavoratori:
      "Puoi assegnare Servi della gleba come Agricoltori. Verde = attualmente in Serra. Stipendio dal Tesoro (voce Bilancio).",
    produce: [
      { etichetta: "Coltura scelta (2 unità/giorno per Agricoltore → suo inventario)" }
    ],
    compra: [{ etichetta: "Nessun acquisto: coltivazione" }]
  }
];

const BY_NOME = new Map(IMPRESE_CATALOGO.map((i) => [i.nomeEdificio, i]));

export function getImpresaDef(nomeEdificio: string): ImpresaDef | undefined {
  return BY_NOME.get(nomeEdificio);
}

export function èImpresa(nomeEdificio: string): boolean {
  return BY_NOME.has(nomeEdificio);
}

export const NOMI_IMPRESE = IMPRESE_CATALOGO.map((i) => i.nomeEdificio);
