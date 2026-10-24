/**
 * Soddisfazione personale a punti (permanenti + temporanei).
 * Distinta da felicità (0–100) e da Popolarità del Re.
 */

import type { Abitante, Casta, Edificio } from "../types";
import { getAlimentazioneAbitante } from "./alimentazione";
import { getCastaAbitante } from "./casta";
import { getEdificioAbitazione } from "./abitanteEdifici";
import { OGGETTI_INVENTARIO } from "./inventario";

export type DurataModificatoreSoddisfazione = "permanente" | "giornaliero" | "mensile";

export type ModificatoreSoddisfazione = {
  id: string;
  delta: number;
  motivo: string;
  durata: DurataModificatoreSoddisfazione;
  /** Giorno di gioco in cui scade (solo giornaliero). */
  scadeGiorno?: number;
  /** Mese+anno di scadenza (solo mensile): mese 1–12, anno. */
  scadeMese?: number;
  scadeAnno?: number;
};

export type FasciaSoddisfazione =
  | "Devoto"
  | "Soddisfatto"
  | "Neutrale"
  | "Insoddisfatto"
  | "Ostile";

export type AzioneOstileProbabile =
  | "nessuna"
  | "scomparsa"
  | "sabotaggio"
  | "rivolta"
  | "attentato";

/** Residenze sufficienti per un Nobile (+1 casa). */
export const ABITAZIONI_AVANZATE = new Set(["Attico", "Villa"]);

/** Qualsiasi abitazione (non senzatetto) dà +1 agli altri. */
export const ABITAZIONI_BASE_OK = new Set([
  "Baracca",
  "Capanna",
  "Dormitorio",
  "Modulo",
  "Villetta",
  "Attico",
  "Villa",
  "Castello"
]);

export function fasciaDaPunteggio(punti: number): FasciaSoddisfazione {
  if (punti >= 5) return "Devoto";
  if (punti >= 2) return "Soddisfatto";
  if (punti >= -1) return "Neutrale";
  if (punti >= -4) return "Insoddisfatto";
  return "Ostile";
}

export function getModificatoriSoddisfazione(a: Abitante): ModificatoreSoddisfazione[] {
  return a.modificatoriSoddisfazione ?? [];
}

export function sommaModificatori(mods: ModificatoreSoddisfazione[]): number {
  return mods.reduce((s, m) => s + m.delta, 0);
}

/** True se l'item cibo ha tag carne. */
export function ciboÈCarne(itemId: string): boolean {
  return (OGGETTI_INVENTARIO[itemId]?.tagCibo ?? []).includes("carne");
}

/** True se cibo senza tag animali (ok vegano). */
export function ciboÈVegetalePuro(itemId: string): boolean {
  const tags = OGGETTI_INVENTARIO[itemId]?.tagCibo ?? [];
  return tags.length === 0;
}

/**
 * Bonus casa derivato (ricalcolato ogni valutazione, non persistito).
 * Nobile: solo Attico/Villa. Altri: qualsiasi residenza.
 */
export function deltaCasaSituazionale(abitante: Abitante, edifici: Edificio[]): number {
  const casa = getEdificioAbitazione(abitante.id, edifici);
  if (!casa) return 0;
  const casta = getCastaAbitante(abitante);
  if (casta === "Nobile") {
    return ABITAZIONI_AVANZATE.has(casa.nome) ? 1 : 0;
  }
  return ABITAZIONI_BASE_OK.has(casa.nome) || casa.tipo === "Residenza" ? 1 : 0;
}

/**
 * Valuta se un pasto appena consumato soddisfa i bisogni di status/personalità.
 * Restituisce i delta cibo (tipicamente 0 o +1).
 */
export function deltaPastoPerBisogni(
  abitante: Abitante,
  itemIdConsumato: string | null
): { delta: number; motivo: string } {
  if (!itemIdConsumato) return { delta: 0, motivo: "Nessun pasto" };
  const casta = getCastaAbitante(abitante);
  const alimentazione = getAlimentazioneAbitante(abitante);
  const vegano =
    alimentazione === "Vegano" || abitante.personalità === "Vegano";

  if (vegano) {
    if (ciboÈVegetalePuro(itemIdConsumato)) {
      return { delta: 1, motivo: "Pasto vegetale (Vegano)" };
    }
    return { delta: 0, motivo: "Pasto non vegetale (Vegano)" };
  }

  if (casta === "Nobile") {
    if (ciboÈCarne(itemIdConsumato)) {
      return { delta: 1, motivo: "Pasto con carne (Nobile)" };
    }
    return { delta: 0, motivo: "Pasto senza carne (Nobile)" };
  }

  return { delta: 1, motivo: "Ha mangiato oggi" };
}

/** Punteggio totale: situazionale casa + modificatori persistiti ancora validi. */
export function calcolaPunteggioSoddisfazione(
  abitante: Abitante,
  edifici: Edificio[],
  giornoGioco: number,
  mese: number,
  anno: number
): number {
  const vivi = getModificatoriSoddisfazione(abitante).filter((m) =>
    modificatoreAncoraAttivo(m, giornoGioco, mese, anno)
  );
  return sommaModificatori(vivi) + deltaCasaSituazionale(abitante, edifici);
}

export function modificatoreAncoraAttivo(
  m: ModificatoreSoddisfazione,
  giornoGioco: number,
  mese: number,
  anno: number
): boolean {
  if (m.durata === "permanente") return true;
  if (m.durata === "giornaliero") {
    return m.scadeGiorno == null || giornoGioco < m.scadeGiorno;
  }
  if (m.durata === "mensile") {
    if (m.scadeAnno == null || m.scadeMese == null) return true;
    if (anno < m.scadeAnno) return true;
    if (anno > m.scadeAnno) return false;
    return mese < m.scadeMese;
  }
  return true;
}

/** Rimuove modificatori scaduti; sostituisce quelli giornalieri dello stesso id. */
export function pulisciModificatoriScaduti(
  abitante: Abitante,
  giornoGioco: number,
  mese: number,
  anno: number
): Abitante {
  const mods = getModificatoriSoddisfazione(abitante).filter((m) =>
    modificatoreAncoraAttivo(m, giornoGioco, mese, anno)
  );
  if (mods.length === (abitante.modificatoriSoddisfazione?.length ?? 0)) return abitante;
  return { ...abitante, modificatoriSoddisfazione: mods.length ? mods : undefined };
}

export function upsertModificatore(abitante: Abitante, mod: ModificatoreSoddisfazione): Abitante {
  const altri = getModificatoriSoddisfazione(abitante).filter((m) => m.id !== mod.id);
  return { ...abitante, modificatoriSoddisfazione: [...altri, mod] };
}

export function aggiungiModificatorePermanente(
  abitante: Abitante,
  id: string,
  delta: number,
  motivo: string
): Abitante {
  const esistente = getModificatoriSoddisfazione(abitante).find((m) => m.id === id);
  if (esistente) {
    return upsertModificatore(abitante, {
      ...esistente,
      delta: esistente.delta + delta,
      motivo: esistente.motivo
    });
  }
  return upsertModificatore(abitante, { id, delta, motivo, durata: "permanente" });
}

/** Bonus pasto: un solo slot giornaliero, scade il giorno dopo. */
export function applicaBonusPastoGiorno(
  abitante: Abitante,
  giornoGioco: number,
  itemIdConsumato: string | null
): Abitante {
  const { delta, motivo } = deltaPastoPerBisogni(abitante, itemIdConsumato);
  if (delta === 0) {
    // Rimuovi eventuale bonus pasto precedente se il pasto non soddisfa
    const senza = getModificatoriSoddisfazione(abitante).filter((m) => m.id !== "pasto_giorno");
    return { ...abitante, modificatoriSoddisfazione: senza.length ? senza : undefined };
  }
  return upsertModificatore(abitante, {
    id: "pasto_giorno",
    delta,
    motivo,
    durata: "giornaliero",
    scadeGiorno: giornoGioco + 1
  });
}

/** ID familiari diretti (coniuge, genitori, figli) ancora vivi. */
export function idsFamiliariDiretti(vittima: Abitante, viviIds: Set<number>): number[] {
  const ids = new Set<number>();
  if (vittima.coniugeId != null && viviIds.has(vittima.coniugeId)) ids.add(vittima.coniugeId);
  for (const id of vittima.genitoriIds ?? []) {
    if (viviIds.has(id)) ids.add(id);
  }
  for (const id of vittima.figliIds ?? []) {
    if (viviIds.has(id)) ids.add(id);
  }
  // Genitori che elencano la vittima come figlio / figli che elencano come genitore già coperti;
  // anche chi ha la vittima in genitoriIds (fratelli non) — aggiungi chi ha vittima come figlio
  return [...ids];
}

/**
 * Lutti individuali, permanenti e registrati una volta sola per vittima:
 * morte ordinaria: -1 familiare; morte causata dal Re: -3 familiare / -1 amico.
 * Un amico che è anche familiare riceve soltanto il -3.
 */
export function applicaLuttoFamiliareERimuoviMorti(
  abitanti: Abitante[],
  idsMorti: ReadonlySet<number>,
  opzioni: { responsabilitaRe?: boolean } = {}
): Abitante[] {
  if (idsMorti.size === 0) return abitanti;
  const viviIds = new Set(abitanti.filter(a => !idsMorti.has(a.id)).map(a => a.id));
  const penalita = new Map<number, { vittimaId: number; punti: number; motivo: string }[]>();

  for (const morto of abitanti.filter(a => idsMorti.has(a.id))) {
    const familiari = new Set(idsFamiliariDiretti(morto, viviIds));
    // Fratelli: condividono un genitore, anche se la relazione non è registrata in entrambi i sensi.
    for (const altro of abitanti) {
      if (!viviIds.has(altro.id) || altro.id === morto.id) continue;
      if ((altro.genitoriIds ?? []).some(id => (morto.genitoriIds ?? []).includes(id))) familiari.add(altro.id);
      if ((altro.figliIds ?? []).includes(morto.id) || (morto.figliIds ?? []).includes(altro.id)) familiari.add(altro.id);
      if ((altro.genitoriIds ?? []).includes(morto.id) || (morto.genitoriIds ?? []).includes(altro.id)) familiari.add(altro.id);
      if (altro.coniugeId === morto.id || morto.coniugeId === altro.id) familiari.add(altro.id);
    }
    const amici = new Set<number>([
      ...(morto.amici ?? []).map(x => x.id),
      ...abitanti.filter(a => (a.amici ?? []).some(x => x.id === morto.id)).map(a => a.id)
    ]);
    for (const id of familiari) {
      const items = penalita.get(id) ?? [];
      items.push({
        vittimaId: morto.id, punti: opzioni.responsabilitaRe ? -3 : -1,
        motivo: opzioni.responsabilitaRe ? "Familiare ucciso per ordine del Re" : "Morte di un familiare"
      });
      penalita.set(id, items);
    }
    if (opzioni.responsabilitaRe) {
      for (const id of amici) {
        if (!viviIds.has(id) || familiari.has(id)) continue;
        const items = penalita.get(id) ?? [];
        items.push({ vittimaId: morto.id, punti: -1, motivo: "Amico ucciso per ordine del Re" });
        penalita.set(id, items);
      }
    }
  }
  return abitanti.filter(a => !idsMorti.has(a.id)).map(a => {
    let next = a;
    for (const penalizzazione of penalita.get(a.id) ?? []) {
      const id = "lutto_" + penalizzazione.vittimaId;
      // Non punire due volte per lo stesso decesso.
      if ((next.modificatoriSoddisfazione ?? []).some(m => m.id === id)) continue;
      next = aggiungiModificatorePermanente(next, id, penalizzazione.punti, penalizzazione.motivo);
    }
    return next;
  });
}

/**
 * Probabilità/azione se Ostile: dipende da personalità (non automatico attentato).
 */
export function azioneProbabileSeOstile(abitante: Abitante, fascia: FasciaSoddisfazione): AzioneOstileProbabile {
  if (fascia !== "Ostile") return "nessuna";
  const p = abitante.personalità;
  if (p === "Psicopatico") return "attentato";
  if (p === "Depresso") return "scomparsa";
  if (p === "Carismatico" || abitante.fazioni?.includes("Rivoluzionari")) return "rivolta";
  if (p === "Pragmatico" || p === "Tiepido") return "sabotaggio";
  return "sabotaggio";
}

export function etichettaFascia(fascia: FasciaSoddisfazione): string {
  return fascia;
}

/** Snapshot UI: punti + fascia + breakdown breve. */
export function snapshotSoddisfazioneAbitante(
  abitante: Abitante,
  edifici: Edificio[],
  giornoGioco: number,
  mese: number,
  anno: number
): {
  punti: number;
  fascia: FasciaSoddisfazione;
  casa: number;
  mods: ModificatoreSoddisfazione[];
  azioneOstile: AzioneOstileProbabile;
} {
  const mods = getModificatoriSoddisfazione(abitante).filter((m) =>
    modificatoreAncoraAttivo(m, giornoGioco, mese, anno)
  );
  const casa = deltaCasaSituazionale(abitante, edifici);
  const punti = sommaModificatori(mods) + casa;
  const fascia = fasciaDaPunteggio(punti);
  return {
    punti,
    fascia,
    casa,
    mods,
    azioneOstile: azioneProbabileSeOstile(abitante, fascia)
  };
}

export function richiedeCarnePerStatus(abitante: Abitante): boolean {
  return getCastaAbitante(abitante) === "Nobile";
}

export function richiedeVegetaliPerPersonalita(abitante: Abitante): boolean {
  return getAlimentazioneAbitante(abitante) === "Vegano" || abitante.personalità === "Vegano";
}

export type { Casta };
