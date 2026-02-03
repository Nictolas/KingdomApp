import type { Abitante, Risorsa, Edificio } from "../../types";

export type EventoDef = {
  id: string;
  nome: string;
  emoji: string;
  descrizione: string;
  durataMesi: number;
  /** Probabilità 0-1 di attivazione quando la condizione è vera */
  probabilità: number;
  condizione: (
    abitanti: Abitante[],
    risorse: Risorsa[],
    edifici: Edificio[],
    punteggioSanzioni: number,
    divietoEspatrioAttivo?: boolean,
    calcolaFelicitàModificata?: (a: Abitante) => number
  ) => boolean;
  /** Effetto all'attivazione (modifica risorse/abitanti/edifici in place). Può restituire messaggio extra per il dialog. */
  applicaAttivazione: (
    risorse: Risorsa[],
    abitanti: Abitante[],
    edifici: Edificio[],
    ctx?: { calcolaFelicitàModificata?: (a: Abitante) => number }
  ) => void | { messaggioExtra?: string };
  /** Effetto ogni mese mentre l'evento è in corso */
  applicaMensile: (risorse: Risorsa[], abitanti: Abitante[], edifici: Edificio[]) => void;
};

/** Helper usato da vari eventi per modificare una risorsa per nome. */
export function modificaRisorsa(risorse: Risorsa[], nome: string, delta: number): void {
  const r = risorse.find(
    (x) => x.nome === nome || x.nome.toLowerCase().includes(nome.toLowerCase())
  );
  if (r) r.quantità = Math.max(0, r.quantità + delta);
}
