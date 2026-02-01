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
export type Reato = "Omicidio" | "Stupro" | "Furto" | "Spaccio" | "Evasione";

/** Relazione con punteggio 1-100 (amicizia o rivalità). */
export type RelazionePunteggio = { id: number; punteggio: number };

export type Abitante = {
  id: number;
  nome: string;
  emoji: string;
  eta: number;
  lavoro: string;
  competenza: number; // 0-100
  produttività: number; // 0-100
  stanchezza: number; // 0-100
  personalità: string;
  amici: RelazionePunteggio[]; // ID + punteggio amicizia 1-100
  rivali: RelazionePunteggio[]; // ID + punteggio rivalità 1-100
  coniugeId?: number; // ID del coniuge (se presente)
  figliIds?: number[]; // ID dei figli
  genitoriIds?: number[]; // ID dei genitori (1 o 2)
  nonniIds?: number[]; // ID dei nonni
  fazioni: string[]; // Ogni abitante può far parte di più fazioni (es. Cittadini, Nativi, Schiavi, Amministrazione, …)
  peso: number; // 0-100: indicatore peso (Denutrito 0-40, Normopeso 41-80, Sovrappeso 81-95, Obeso 96+)
  salute: number; // 0-100: salute fisica (usata da eventi/ferite)
  crediti: number; // Monete
  reddito: number; // Monete al mese
  spese: number; // Monete al mese
  lealtà: number; // 0-100
  paura: number; // 0-100
  felicità: number; // 1-100
  ministero?: string; // Ministero assegnato (se è ministro)
  ruoloSchiavitu?: "schiavista" | "schiavo"; // Ruolo nella schiavitù
  schiavistaId?: number; // ID dello schiavista (se è schiavo)
  religione: "Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto degli Alieni"; // Religione dell'abitante
  specie?: "umano" | "alieno"; // Specie dell'abitante (alieno = non Umano)
  razza?: Razza; // Razza/Pianeta di origine dell'abitante
  reati?: Reato[]; // Se presente e non vuoto, l'abitante è considerato "criminale"
  sesso?: "M" | "F"; // Sesso dell'abitante
  orientamento?: "Etero" | "Omo" | "Bi"; // Orientamento sessuale (per matrimonio)
};

// Razze trovabili tra gli abitanti (pianeti di origine)
export type Razza =
  | "Umano"
  | "Grigi"
  | "Nordici"
  | "Rettiliani"
  | "Insettoidi"
  | "Marini"
  | "Ferini";

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

/** Evento attivo nella colonia; si attiva al cambio mese se sono soddisfatte le condizioni. */
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
  manutenzione: number; // Costo mensile
  stato: "Operativo" | "In costruzione" | "In manutenzione" | "Danneggiato";
  livello: number; // Livello dell'edificio
  produzione?: string; // Cosa produce (se applicabile)
  consumo?: string; // Cosa consuma (se applicabile)
};
