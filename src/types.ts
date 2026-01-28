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
  amici: number[]; // Array di ID di altri abitanti
  rivali: number[]; // Array di ID di altri abitanti
  fazione: string;
  salute: number; // 0-100
  crediti: number; // Monete
  reddito: number; // Monete al mese
  spese: number; // Monete al mese
  lealtà: number; // 0-100
  paura: number; // 0-100
  ministero?: string; // Ministero assegnato (se è ministro)
};

export type Ministro = {
  id: number;
  nome: string;
  ministero: string;
  fazione: string;
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
