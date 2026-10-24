/**
 * Nomi e cognomi per abitanti umani, con sesso coerente (es. Alessandro sempre M, Anna sempre F).
 * Usato da generazionePartita e immigrazione.
 */
export const NOMI_UMANI_CON_SESSO: { nome: string; sesso: "M" | "F" }[] = [
  { nome: "Marco", sesso: "M" },
  { nome: "Luca", sesso: "M" },
  { nome: "Anna", sesso: "F" },
  { nome: "Sofia", sesso: "F" },
  { nome: "Giovanni", sesso: "M" },
  { nome: "Elena", sesso: "F" },
  { nome: "Alessandro", sesso: "M" },
  { nome: "Chiara", sesso: "F" },
  { nome: "Francesco", sesso: "M" },
  { nome: "Maria", sesso: "F" },
  { nome: "Andrea", sesso: "M" },
  { nome: "Laura", sesso: "F" }
];

export const COGNOMI_UMANI = [
  "Rossi", "Bianchi", "Verdi", "Neri", "Blu", "Gialli", "Ferrari", "Romano", "Colombo", "Ricci"
];

/** Sceglie nome e cognome casuali con sesso coerente al nome. */
export function scegliNomeCognomeUmano(): { nomeCompleto: string; sesso: "M" | "F" } {
  const entry = NOMI_UMANI_CON_SESSO[Math.floor(Math.random() * NOMI_UMANI_CON_SESSO.length)];
  const cognome = COGNOMI_UMANI[Math.floor(Math.random() * COGNOMI_UMANI.length)];
  return { nomeCompleto: `${entry.nome} ${cognome}`, sesso: entry.sesso };
}

/** Normalizza nome/cognome inseriti nella creazione del Re. */
export function capitalizzaNomePersona(value: string): string {
  return value.trim().toLocaleLowerCase("it-IT").replace(/(^|[\s'-])\p{L}/gu, (part) => part.toLocaleUpperCase("it-IT"));
}
