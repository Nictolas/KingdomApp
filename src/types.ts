
import type { AspettoPersonaggio } from "./game/personaggioAspetto";

export type Point = { x: number; y: number };
export type Placed = { x: number; y: number; id: number };
export type Bridge = { x: number; y: number };
export type Light = { x: number; y: number; id: number };

export type BuildingType = "castle" | "farm" | "house" | "bar";

export type Building = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  emoji: string;
  description: string;
  type: BuildingType;
};

export type Character = {
  id: number;
  x: number; // float per animazione
  y: number; // float per animazione
  targetX: number; // intero (griglia)
  targetY: number; // intero (griglia)
  emoji: string;
  profession: string;
  name: string;
  age: number;
  lastMove: number;
  isInCastle?: boolean;
  isInFarm?: boolean;
  isInHouse?: boolean;
};

// Nuovi tipi per il gestionale del regno
export type Reato = "Omicidio" | "Stupro" | "Furto" | "Spaccio" | "Evasione" | "Ex Governatore";

/** Livello di istruzione completato o in corso. */
export type TitoloDiStudio = "Asilo" | "Elementare" | "Superiore" | "Università";

/** Area di competenza professionale dell'abitante. */
export type Specializzazione = "Legge" | "Medicina" | "Educazione" | "Agraria";

/** Classe sociale dell'abitante (casta). */
export type Casta = "Schiavo" | "Servo della gleba" | "Cittadino" | "Nobile" | "Clero";

/** @deprecated Usare Casta */
export type Ceto = Casta;

/** Regime alimentare dell'abitante. */
export type Alimentazione = "Onnivoro" | "Vegetariano" | "Vegano";

/** Relazione con punteggio 1-100 (amicizia o rivalità). */
export type RelazionePunteggio = { id: number; punteggio: number };

export type Abitante = {
  id: number;
  nome: string;
  emoji: string;
  eta: number;
  lavoro: string;
  competenza: number; // 0-100 (uso interno; non mostrato in UI)
  produttività: number; // 0-100
  stanchezza: number; // 0-100
  /** Legge, Medicina, Educazione o Agraria. */
  specializzazione?: Specializzazione;
  personalità: string;
  /** Separato dalla personalità; opzionale per compatibilità con i salvataggi precedenti. */
  alimentazione?: Alimentazione;
  amici: RelazionePunteggio[]; // ID + punteggio amicizia 1-100
  rivali: RelazionePunteggio[]; // ID + punteggio rivalità 1-100
  coniugeId?: number; // ID del coniuge (se presente)
  figliIds?: number[]; // ID dei figli
  figliAdottatiIds?: number[];
  genitoriIds?: number[]; // ID dei genitori (1 o 2)
  genitoriAdottiviIds?: number[];
  nonniIds?: number[]; // ID dei nonni
  fazioni: string[]; // Ogni abitante può far parte di più fazioni (es. Cittadini, Nativi, Schiavi, Amministrazione, …)
  peso: number; // 0-100: indicatore peso (Denutrito 0-40, Normopeso 41-80, Sovrappeso 81-95, Obeso 96+)
  salute: number; // 0-100: salute fisica (usata da eventi/ferite)
  /**
   * @deprecated Usa monete nell'inventario (`itemId: "monete"`).
   * Tenuto opzionale solo per migrazione; viene azzerato in normalizza.
   */
  crediti?: number;
  reddito: number; // Monete/mese (display; allineato allo stipendio base)
  spese: number; // Legacy display; saldo monete usa solo costi reali (affitto, bar, negozio)
  lealtà: number; // 0-100
  paura: number; // 0-100
  felicità: number; // 1-100
  ministero?: string; // Ministero assegnato (se è ministro)
  /** Classe sociale: Schiavo, Servo della gleba, Cittadino o Nobile. */
  casta?: Casta;
  /** @deprecated Usare casta */
  ceto?: Casta;
  ruoloSchiavitu?: "schiavista" | "schiavo"; // Ruolo nella schiavitù
  schiavistaId?: number; // ID dello schiavista (se è schiavo)
  religione: "Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto delle Ombre" | string; // Religione canonica o creata dal giocatore
  /** Livello scolastico (Asilo → Università). */
  titoloStudio?: TitoloDiStudio;
  specie?: "umano" | "alieno"; // Specie dell'abitante (alieno = non Umano)
  razza?: Razza; // Razza/Pianeta di origine dell'abitante
  /** Aspetto modulare scelto nell'editor del Re o generato per l'abitante. */
  aspetto?: AspettoPersonaggio;
  reati?: Reato[]; // Se presente e non vuoto, l'abitante è considerato imputato
  /** Mesi/anni di carcere residui dopo sentenza del giudice (1 unità = 1 mese di gioco). */
  anniCarcereResidui?: number;
  sesso?: "M" | "F"; // Sesso dell'abitante
  orientamento?: "Etero" | "Omo" | "Bi" | "Asessuale"; // Orientamento sessuale (per matrimonio)
  incinta?: boolean; // Gravidanza (stato salute "Incinta")
  /** Mese/anno inizio gravidanza (per parto a 9 mesi). */
  gravidanzaIniziataMese?: number;
  gravidanzaIniziataAnno?: number;
  /** Oggetti portati dall'abitante (monete, cibo, …). */
  inventario?: { itemId: string; quantità: number }[];
  /** Ultimo bottino trovato nel Bosco (Raccoglitore). */
  ultimoRaccoltoBosco?: {
    giorno: number;
    voci: { itemId: string; emoji: string; nome: string; quantità: number }[];
  };
  /** Ultimo bottino estratto in Miniera (Minatore). */
  ultimoRaccoltoMiniera?: {
    giorno: number;
    voci: { itemId: string; emoji: string; nome: string; quantità: number }[];
  };
  /** Ultimo raccolto dalla Serra (Agricoltore). */
  ultimoRaccoltoSerra?: {
    giorno: number;
    voci: { itemId: string; emoji: string; nome: string; quantità: number }[];
  };
  /** Ultimo giorno di gioco in cui ha consumato un oggetto Cibo dall'inventario. */
  ultimoGiornoCiboConsumato?: number;
  /** Bisogni 0–100 (Fame, Energia, Divertimento, Socialità, Igiene). */
  bisogni?: {
    fame: number;
    energia: number;
    divertimento: number;
    socialita: number;
    igiene: number;
  };
  modificatoriSoddisfazione?: {
    id: string;
    delta: number;
    motivo: string;
    durata: "permanente" | "giornaliero" | "mensile";
    scadeGiorno?: number;
    scadeMese?: number;
    scadeAnno?: number;
  }[];
};

// Razze trovabili tra gli abitanti (pianeti di origine o sintetici)
export type Razza =
  | "Umano"
  | "Scheletro"
  | "Vampiro"
  | "Lucertoloide"
  | "Elfo"
  | "Nano"
  | "Orco"
  | "Goblin"
  | "Golem";

export const RAZZE_ABITANTI = [
  "Umano",
  "Nano",
  "Scheletro",
  "Vampiro",
  "Goblin",
  "Orco",
  "Lucertoloide"
] as const satisfies readonly Razza[];

export type Ministro = {
  id: number;
  nome: string;
  ministero: string;
  fazioni: string[]; // come Abitante
};

export type Fazione = {
  id: number;
  nome: string;
  emoji: string;
  descrizione: string;
};

export type Legge = {
  id: number;
  titolo: string;
  descrizione: string;
  stato: "Proposta" | "In vigore" | "Abrogata";
};

export type Risorsa = {
  id: number;
  nome: string;
  quantità: number;
  unità: string;
};

/** Evento attivo nel regno; si attiva al cambio mese se sono soddisfatte le condizioni. */
export type EventoInCorso = {
  id: string;
  iniziatoMese: number;
  iniziatoAnno: number;
  durataMesi: number;
};

/** Ordine di acquisto o vendita nel Mercato; si esegue al cambio mese (Skip Mese). */
export type OrdineMercato = {
  id: number;
  tipo: "compra" | "vendi";
  risorsaId: number;
  quantità: number;
  prezzoUnitario: number;
};

export type Edificio = {
  id: number;
  nome: string;
  emoji: string;
  tipo: string;
  descrizione: string;
  capacità: number; // Numero di persone che può ospitare
  occupazione: number; // Numero attuale di persone
  abitantiAssegnati: number[]; // Array di ID degli abitanti assegnati
  efficienza: number; // 0-100
  manutenzione: number; // Obsoleto: non usato; costo mensile = stipendioPerLavoratore × lavoratori (monete tesoro)
  stato: "Operativo" | "In costruzione" | "In manutenzione" | "Danneggiato";
  livello: number; // Livello dell'edificio
  produzione?: string; // Cosa produce (se applicabile)
  consumo?: string; // Cosa consuma (se applicabile)
  /** Stipendio mensile per ogni lavoratore assegnato (configurabile dall'utente). Costo edificio = stipendioPerLavoratore × numero lavoratori. */
  stipendioPerLavoratore?: number;
  /** Impresa privata con cassa separata dal Tesoro del regno. */
  categoriaEconomica?: "Impresa";
  /** Cassa monetaria dell'impresa. */
  cassaMonete?: number;
  /** Fatturato clienti del mese corrente (per tassa impresa); azzerato a fine mese. */
  fatturatoMeseMonete?: number;
  /** Solo Serra: id oggetto Cibo vegetale prodotto (1 unità/giorno). */
  colturaItemId?: string;
  /** Solo Chiesa: religione del tempio (non Ateo/Deista/Agnostico). */
  religioneTempio?: string;
  /** 0–100: avanzamento cantiere (solo se stato === "In costruzione"). Completato dagli edili dell'Ufficio Edile. */
  progressoCostruzione?: number;
};
