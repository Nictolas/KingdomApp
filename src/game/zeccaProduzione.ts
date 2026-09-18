/**
 * Zecca: consuma Metalli dalle risorse del regno e accredita monete al Tesoro.
 */

import type { Edificio, Risorsa } from "../types";

export const NOME_ZECCA = "Zecca";
export const LAVORO_MONETIERE = "Monetiere";

/** Metalli convertiti al giorno per ogni Monetiere (se disponibili). */
export const METALLI_PER_LAVORATORE_GIORNO = 2;

/**
 * Monete di Tesoro per ogni unità di Metallo (pezzo d’oro) coniata.
 * Con 1 Metallo/giorno per Minatore e stipendio base 1 moneta/giorno,
 * 3 monete/Metallo lasciano margine per Monetiere e altri costi.
 */
export const MONETE_PER_UNITA_METALLO = 3;

export const NOME_RISORSA_METALLI = "Metalli";

export function èZecca(edificio: Pick<Edificio, "nome">): boolean {
  return edificio.nome === NOME_ZECCA;
}

export function quantitaRisorsa(risorse: Risorsa[], nome: string): number {
  const r = risorse.find((x) => x.nome === nome);
  return r ? Math.max(0, Math.floor(r.quantità)) : 0;
}

export function stimaConioMensileZecca(edifici: Edificio[], risorse: Risorsa[]): number {
  let capacita = 0;
  for (const e of edifici) {
    if (!èZecca(e) || e.stato !== "Operativo") continue;
    const n = e.abitantiAssegnati?.length ?? 0;
    capacita += n * METALLI_PER_LAVORATORE_GIORNO * 30;
  }
  const metalli = quantitaRisorsa(risorse, NOME_RISORSA_METALLI);
  const convertibili = Math.min(capacita, metalli);
  return convertibili * MONETE_PER_UNITA_METALLO;
}

/**
 * Converte Metalli → moneteGiocatore per `giorni` di lavoro della Zecca.
 */
export function applicaZeccaGiornaliera(
  risorse: Risorsa[],
  edifici: Edificio[],
  moneteGiocatore: number,
  giorni: number
): { risorse: Risorsa[]; moneteGiocatore: number; moneteConiate: number } {
  if (giorni <= 0) {
    return { risorse, moneteGiocatore, moneteConiate: 0 };
  }

  let metalliDisponibili = quantitaRisorsa(risorse, NOME_RISORSA_METALLI);
  let moneteConiate = 0;

  for (let g = 0; g < giorni; g++) {
    let domanda = 0;
    for (const e of edifici) {
      if (!èZecca(e) || e.stato !== "Operativo") continue;
      const n = e.abitantiAssegnati?.length ?? 0;
      if (n <= 0) continue;
      domanda += n * METALLI_PER_LAVORATORE_GIORNO;
    }
    if (domanda <= 0 || metalliDisponibili <= 0) continue;
    const convertito = Math.min(domanda, metalliDisponibili);
    metalliDisponibili -= convertito;
    moneteConiate += convertito * MONETE_PER_UNITA_METALLO;
  }

  if (moneteConiate <= 0) {
    return { risorse, moneteGiocatore, moneteConiate: 0 };
  }

  const risorseNext = risorse.map((r) => {
    if (r.nome !== NOME_RISORSA_METALLI) return r;
    return { ...r, quantità: Math.max(0, Math.floor(r.quantità) - moneteConiate / MONETE_PER_UNITA_METALLO) };
  });

  return {
    risorse: risorseNext,
    moneteGiocatore: Math.max(0, Math.floor(moneteGiocatore)) + moneteConiate,
    moneteConiate
  };
}
