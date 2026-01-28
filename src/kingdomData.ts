import type { Abitante, Ministro, Fazione, Legge, Risorsa } from "./types";

export const abitantiData: Abitante[] = [
  {
    id: 1,
    nome: "Re Artù",
    eta: 35,
    lavoro: "Sovrano",
    competenza: 95,
    produttività: 88,
    stanchezza: 25,
    personalità: "Nobile e giusto",
    amici: [2, 3],
    rivali: [],
    fazione: "Corona",
    salute: 90,
    crediti: 5000,
    reddito: 2000,
    spese: 1500,
    lealtà: 100,
    paura: 5
  },
  {
    id: 2,
    nome: "Morgana",
    eta: 32,
    lavoro: "Consigliera",
    competenza: 92,
    produttività: 85,
    stanchezza: 30,
    personalità: "Astuta e strategica",
    amici: [1, 5],
    rivali: [4],
    fazione: "Arcani",
    salute: 88,
    crediti: 3200,
    reddito: 1200,
    spese: 800,
    lealtà: 85,
    paura: 10
  },
  {
    id: 3,
    nome: "Luca",
    eta: 28,
    lavoro: "Contadino",
    competenza: 75,
    produttività: 90,
    stanchezza: 60,
    personalità: "Lavoratore instancabile",
    amici: [1, 4],
    rivali: [],
    fazione: "Popolo",
    salute: 85,
    crediti: 450,
    reddito: 300,
    spese: 200,
    lealtà: 75,
    paura: 20
  },
  {
    id: 4,
    nome: "Giovanni",
    eta: 40,
    lavoro: "Artigiano",
    competenza: 88,
    produttività: 82,
    stanchezza: 35,
    personalità: "Perfezionista e orgoglioso",
    amici: [3, 5],
    rivali: [2],
    fazione: "Popolo",
    salute: 80,
    crediti: 1200,
    reddito: 500,
    spese: 350,
    lealtà: 70,
    paura: 15
  },
  {
    id: 5,
    nome: "Elena",
    eta: 26,
    lavoro: "Studiosa",
    competenza: 90,
    produttività: 78,
    stanchezza: 40,
    personalità: "Curiosa e idealista",
    amici: [2, 4],
    rivali: [],
    fazione: "Accademia",
    salute: 92,
    crediti: 800,
    reddito: 400,
    spese: 250,
    lealtà: 80,
    paura: 12
  }
];

export const ministriData: Ministro[] = [
  { id: 1, nome: "Morgana", ministero: "Magia e Sapienza", fazione: "Arcani" },
  { id: 2, nome: "Marco", ministero: "Agricoltura", fazione: "Popolo" },
  { id: 3, nome: "Isabella", ministero: "Tesoro Reale", fazione: "Corona" }
];

export const fazioniData: Fazione[] = [
  { id: 1, nome: "Corona", descrizione: "Difende il potere del Re e la stabilità del regno." },
  { id: 2, nome: "Popolo", descrizione: "Vuole più diritti per contadini e artigiani." },
  { id: 3, nome: "Arcani", descrizione: "Ordine di maghi e sapienti, interessati alla conoscenza." },
  { id: 4, nome: "Accademia", descrizione: "Studiosi e maestri che formano le nuove generazioni." }
];

export const leggiData: Legge[] = [
  {
    id: 1,
    titolo: "Tassa sul Grano",
    descrizione: "Una tassa del 10% su tutto il raccolto di grano.",
    stato: "In vigore"
  },
  {
    id: 2,
    titolo: "Carta dei Diritti del Popolo",
    descrizione: "Riconosce alcuni diritti fondamentali a tutti gli abitanti.",
    stato: "Proposta"
  },
  {
    id: 3,
    titolo: "Decreto sulla Magia",
    descrizione: "Regola l'uso della magia all'interno delle mura della città.",
    stato: "In vigore"
  }
];

export const risorseData: Risorsa[] = [
  { id: 1, nome: "Oro", quantità: 1250, unità: "monete" },
  { id: 2, nome: "Grano", quantità: 430, unità: "sacchi" },
  { id: 3, nome: "Legno", quantità: 780, unità: "tronchi" },
  { id: 4, nome: "Influenza della Corona", quantità: 68, unità: "punti" },
  { id: 5, nome: "Fiducia del Popolo", quantità: 74, unità: "punti" }
];

