import type { Ministro } from "../types";

export const ministeriDisponibili = [
  "Ministero dell'Agricoltura",
  "Ricerca e Sviluppo",
  "Produzione Alimentare",
  "Finanze Coloniali",
  "Difesa e Sicurezza",
  "Infrastrutture",
  "Sanità Pubblica",
  "Educazione"
];

export const ministriData: Ministro[] = [
  { id: 1, nome: "Dr. Marcus Volkov", ministero: "Ricerca e Sviluppo", fazioni: ["Scienziati", "Cittadini"] },
  { id: 2, nome: "Luca Rodriguez", ministero: "Produzione Alimentare", fazioni: ["Lavoratori", "Cittadini"] },
  { id: 3, nome: "Isabella Kim", ministero: "Finanze Coloniali", fazioni: ["Amministrazione", "Cittadini"] }
];
