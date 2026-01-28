import type { Abitante, Ministro, Fazione, Legge, Risorsa, Edificio } from "./types";

export const abitantiData: Abitante[] = [
  {
    id: 1,
    nome: "Comandante Sarah Chen",
    emoji: "👩‍🚀",
    eta: 35,
    lavoro: "Comandante della Colonia",
    competenza: 95,
    produttività: 88,
    stanchezza: 25,
    personalità: "Decisa e strategica",
    amici: [2, 3],
    rivali: [],
    fazione: "Amministrazione",
    salute: 90,
    crediti: 5000,
    reddito: 2000,
    spese: 1500,
    lealtà: 100,
    paura: 5
  },
  {
    id: 2,
    nome: "Dr. Marcus Volkov",
    emoji: "👨‍🔬",
    eta: 32,
    lavoro: "Consigliere Scientifico",
    competenza: 92,
    produttività: 85,
    stanchezza: 30,
    personalità: "Analitico e metodico",
    amici: [1, 5],
    rivali: [4],
    fazione: "Scienziati",
    salute: 88,
    crediti: 3200,
    reddito: 1200,
    spese: 800,
    lealtà: 85,
    paura: 10,
    ministero: "Ricerca e Sviluppo"
  },
  {
    id: 3,
    nome: "Luca Rodriguez",
    emoji: "👨‍🌾",
    eta: 28,
    lavoro: "Tecnico Agricolo",
    competenza: 75,
    produttività: 90,
    stanchezza: 60,
    personalità: "Lavoratore instancabile",
    amici: [1, 4],
    rivali: [],
    fazione: "Lavoratori",
    salute: 85,
    crediti: 450,
    reddito: 300,
    spese: 200,
    lealtà: 75,
    paura: 20,
    ministero: "Produzione Alimentare"
  },
  {
    id: 4,
    nome: "Giovanni Tanaka",
    emoji: "👨‍🔧",
    eta: 40,
    lavoro: "Ingegnere Meccanico",
    competenza: 88,
    produttività: 82,
    stanchezza: 35,
    personalità: "Perfezionista e orgoglioso",
    amici: [3, 5],
    rivali: [2],
    fazione: "Lavoratori",
    salute: 80,
    crediti: 1200,
    reddito: 500,
    spese: 350,
    lealtà: 70,
    paura: 15
  },
  {
    id: 5,
    nome: "Elena Petrov",
    emoji: "👩‍🔬",
    eta: 26,
    lavoro: "Ricercatrice",
    competenza: 90,
    produttività: 78,
    stanchezza: 40,
    personalità: "Curiosa e idealista",
    amici: [2, 4],
    rivali: [],
    fazione: "Scienziati",
    salute: 92,
    crediti: 800,
    reddito: 400,
    spese: 250,
    lealtà: 80,
    paura: 12
  }
];

export const ministeriDisponibili = [
  "Ricerca e Sviluppo",
  "Produzione Alimentare",
  "Finanze Coloniali",
  "Difesa e Sicurezza",
  "Infrastrutture",
  "Sanità Pubblica",
  "Educazione"
];

export const ministriData: Ministro[] = [
  { id: 1, nome: "Dr. Marcus Volkov", ministero: "Ricerca e Sviluppo", fazione: "Scienziati" },
  { id: 2, nome: "Luca Rodriguez", ministero: "Produzione Alimentare", fazione: "Lavoratori" },
  { id: 3, nome: "Isabella Kim", ministero: "Finanze Coloniali", fazione: "Amministrazione" }
];

export const fazioniData: Fazione[] = [
  { id: 1, nome: "Amministrazione", emoji: "🏛️", descrizione: "Sostiene l'autorità del Comandante e la stabilità della colonia." },
  { id: 2, nome: "Lavoratori", emoji: "🔧", descrizione: "Rappresenta i diritti dei tecnici e operai della colonia." },
  { id: 3, nome: "Scienziati", emoji: "🔬", descrizione: "Gruppo di ricercatori interessati al progresso tecnologico." },
  { id: 4, nome: "Esploratori", emoji: "🚀", descrizione: "Coloni che vogliono espandere i confini della colonia." }
];

export const leggiData: Legge[] = [
  {
    id: 1,
    titolo: "Tassa sulla Produzione",
    descrizione: "Una tassa del 10% su tutte le risorse prodotte nella colonia.",
    stato: "In vigore"
  },
  {
    id: 2,
    titolo: "Carta dei Diritti dei Coloni",
    descrizione: "Riconosce alcuni diritti fondamentali a tutti i membri della colonia.",
    stato: "Proposta"
  },
  {
    id: 3,
    titolo: "Regolamento sull'Uso dell'Energia",
    descrizione: "Stabilisce norme per l'utilizzo efficiente dell'energia nella colonia.",
    stato: "In vigore"
  },
  {
    id: 4,
    titolo: "Tassa sul Patrimonio",
    descrizione: "Una tassa progressiva sul patrimonio dei coloni basata sui loro crediti accumulati.",
    stato: "In vigore"
  },
  {
    id: 5,
    titolo: "Tassa sul Reddito",
    descrizione: "Sistema di tassazione progressiva sul reddito mensile degli abitanti con scaglioni fiscali.",
    stato: "In vigore"
  }
];

export const risorseData: Risorsa[] = [
  { id: 1, nome: "Crediti", quantità: 1250, unità: "crediti" },
  { id: 2, nome: "Cibo", quantità: 430, unità: "razioni" },
  { id: 3, nome: "Metalli", quantità: 780, unità: "tonnellate" },
  { id: 4, nome: "Energia", quantità: 68, unità: "MW" },
  { id: 5, nome: "Ossigeno", quantità: 95, unità: "%" }
];

export const edificiData: Edificio[] = [
  {
    id: 1,
    nome: "Centro di Comando",
    emoji: "🏛️",
    tipo: "Amministrazione",
    descrizione: "Quartier generale della colonia. Coordina tutte le operazioni.",
    capacità: 20,
    occupazione: 5,
    abitantiAssegnati: [],
    efficienza: 92,
    manutenzione: 500,
    stato: "Operativo",
    livello: 3
  },
  {
    id: 2,
    nome: "Serra Idroponica Alpha",
    emoji: "🌱",
    tipo: "Agricoltura",
    descrizione: "Produce cibo e ossigeno per la colonia.",
    capacità: 15,
    occupazione: 8,
    abitantiAssegnati: [],
    efficienza: 85,
    manutenzione: 300,
    stato: "Operativo",
    livello: 2,
    produzione: "Cibo, Ossigeno"
  },
  {
    id: 3,
    nome: "Raffineria Mineraria",
    emoji: "⚙️",
    tipo: "Industria",
    descrizione: "Processa i minerali estratti e produce materiali utili.",
    capacità: 25,
    occupazione: 12,
    abitantiAssegnati: [],
    efficienza: 78,
    manutenzione: 450,
    stato: "Operativo",
    livello: 2,
    produzione: "Metalli raffinati",
    consumo: "Energia"
  },
  {
    id: 4,
    nome: "Quartieri Residenziali Settore A",
    emoji: "🏠",
    tipo: "Residenza",
    descrizione: "Alloggi per i coloni. Fornisce comfort e riposo.",
    capacità: 50,
    occupazione: 35,
    abitantiAssegnati: [],
    efficienza: 88,
    manutenzione: 200,
    stato: "Operativo",
    livello: 1
  },
  {
    id: 5,
    nome: "Laboratorio di Ricerca",
    emoji: "🔬",
    tipo: "Scienza",
    descrizione: "Centro di ricerca avanzata per migliorare le tecnologie della colonia.",
    capacità: 10,
    occupazione: 6,
    abitantiAssegnati: [],
    efficienza: 90,
    manutenzione: 400,
    stato: "Operativo",
    livello: 2
  },
  {
    id: 6,
    nome: "Centrale Energetica",
    emoji: "⚡",
    tipo: "Infrastruttura",
    descrizione: "Genera energia per tutta la colonia utilizzando pannelli solari e reattori.",
    capacità: 8,
    occupazione: 4,
    abitantiAssegnati: [],
    efficienza: 95,
    manutenzione: 350,
    stato: "Operativo",
    livello: 3,
    produzione: "Energia"
  },
  {
    id: 7,
    nome: "Ospedale Coloniale",
    emoji: "🏥",
    tipo: "Sanità",
    descrizione: "Struttura medica avanzata per curare feriti e malati.",
    capacità: 30,
    occupazione: 8,
    abitantiAssegnati: [],
    efficienza: 82,
    manutenzione: 380,
    stato: "Operativo",
    livello: 2
  },
  {
    id: 8,
    nome: "Hangar di Manutenzione",
    emoji: "🚁",
    tipo: "Trasporti",
    descrizione: "Manutiene e ripara veicoli e navi spaziali.",
    capacità: 12,
    occupazione: 5,
    abitantiAssegnati: [],
    efficienza: 75,
    manutenzione: 320,
    stato: "In manutenzione",
    livello: 1
  }
];

