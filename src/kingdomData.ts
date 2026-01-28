import type { Abitante, Ministro, Fazione, Legge, Risorsa } from "./types";

export const abitantiData: Abitante[] = [
  { id: 1, nome: "Re Artù", ruolo: "Sovrano", eta: 35, fazione: "Corona", èMinistro: false },
  { id: 2, nome: "Morgana", ruolo: "Consigliera", eta: 32, fazione: "Arcani", èMinistro: true },
  { id: 3, nome: "Luca", ruolo: "Contadino", eta: 28, fazione: "Popolo" },
  { id: 4, nome: "Giovanni", ruolo: "Artigiano", eta: 40, fazione: "Popolo" },
  { id: 5, nome: "Elena", ruolo: "Studiosa", eta: 26, fazione: "Accademia" }
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

