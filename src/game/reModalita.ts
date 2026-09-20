/**
 * Modalità del Re, Popolarità (reputazione globale) e fasi di disordine.
 * Popolarità ≠ Soddisfazione individuale.
 */

import type { Abitante, Edificio } from "../types";
import {
  calcolaPunteggioSoddisfazione,
  fasciaDaPunteggio,
  type FasciaSoddisfazione
} from "./soddisfazione";

export type ModalitaRe = "nel_castello" | "a_giro" | "in_visita";

export type FaseDisordine = "nessuna" | "protesta" | "ribellione";

export const POPOLARITA_DEFAULT = 50;
export const MESI_CASTELLO_AVVISO = 3;
/** Quota Ostili per protesta (≥). */
export const SOGLIA_PROTESTA_OSTILI = 0.05;
/** Quota Ostili per ribellione (≥). */
export const SOGLIA_RIBELLIONE_OSTILI = 0.1;

export type StatoRePolitica = {
  modalitaRe: ModalitaRe;
  /** Edificio visitato se modalita === in_visita. */
  edificioVisitaReId: number | null;
  /** 0–100 reputazione generale del Re. */
  popolaritaRe: number;
  /** Mesi consecutivi passati nel castello. */
  mesiConsecutiviNelCastello: number;
  faseDisordine: FaseDisordine;
  /** Avviso soft già emesso per “il Re è vivo?”. */
  avvisoReAssenteEmesso: boolean;
};

export const STATO_RE_DEFAULT: StatoRePolitica = {
  /** A inizio partita il Re è fuori dal Castello (sulla mappa). */
  modalitaRe: "a_giro",
  edificioVisitaReId: null,
  popolaritaRe: POPOLARITA_DEFAULT,
  mesiConsecutiviNelCastello: 0,
  faseDisordine: "nessuna",
  avvisoReAssenteEmesso: false
};

export function clampPopolarita(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function etichettaModalitaRe(m: ModalitaRe): string {
  switch (m) {
    case "nel_castello":
      return "Nel Castello";
    case "a_giro":
      return "A giro";
    case "in_visita":
      return "In visita";
  }
}

export function vulnerabileAttentato(modalita: ModalitaRe): boolean {
  return modalita === "a_giro" || modalita === "in_visita";
}

export function sicurezzaMassima(modalita: ModalitaRe): boolean {
  return modalita === "nel_castello";
}

/** Bonus produzione edificio in visita (moltiplicatore 1.15). */
export const BONUS_PRODUZIONE_VISITA = 1.15;

/** Id edificio con buff produzione se il Re è in visita su un edificio operativo. */
export function edificioBuffVisitaCorrente(
  stato: Pick<StatoRePolitica, "modalitaRe" | "edificioVisitaReId">,
  edifici: Edificio[]
): number | null {
  if (stato.modalitaRe !== "in_visita") return null;
  const id = stato.edificioVisitaReId;
  if (id == null) return null;
  const edificio = edifici.find((e) => e.id === id && e.stato === "Operativo");
  return edificio ? id : null;
}

/** Applica il +15% storico solo a una quantità di produzione positiva. */
export function applicaMoltiplicatoreProduzione(quantità: number, buff: boolean): number {
  if (!buff || quantità <= 0) return quantità;
  return Math.floor(quantità * BONUS_PRODUZIONE_VISITA);
}

export type TickReMeseResult = {
  stato: StatoRePolitica;
  avvisoDiario: string | null;
  /** Id edificio con buff produzione questo mese. */
  edificioBuffId: number | null;
};

/**
 * Aggiorna popolarità e mesi castello in base alla modalità scelta.
 * A giro: +2 popolarità. Castello prolungato: −3 e avviso. Visita: buff edificio.
 */
export function tickModalitaReMensile(
  stato: StatoRePolitica,
  edifici: Edificio[]
): TickReMeseResult {
  let next: StatoRePolitica = { ...stato };
  let avviso: string | null = null;
  let edificioBuffId: number | null = null;

  if (next.modalitaRe === "a_giro") {
    next.mesiConsecutiviNelCastello = 0;
    next.avvisoReAssenteEmesso = false;
    next.popolaritaRe = clampPopolarita(next.popolaritaRe + 2);
  } else if (next.modalitaRe === "in_visita") {
    next.mesiConsecutiviNelCastello = 0;
    next.avvisoReAssenteEmesso = false;
    const id = next.edificioVisitaReId;
    const ok = id != null && edifici.some((e) => e.id === id && e.stato === "Operativo");
    if (ok) {
      edificioBuffId = id;
      next.popolaritaRe = clampPopolarita(next.popolaritaRe + 1);
    } else {
      next.modalitaRe = "nel_castello";
      next.edificioVisitaReId = null;
      next.mesiConsecutiviNelCastello = 1;
    }
  } else {
    next.mesiConsecutiviNelCastello += 1;
    next.edificioVisitaReId = null;
    if (next.mesiConsecutiviNelCastello >= MESI_CASTELLO_AVVISO) {
      next.popolaritaRe = clampPopolarita(next.popolaritaRe - 3);
      if (!next.avvisoReAssenteEmesso) {
        avviso =
          "Gli abitanti si chiedono se il Re sia ancora vivo: stare sempre nel Castello cala la Popolarità.";
        next.avvisoReAssenteEmesso = true;
      }
    }
  }

  return { stato: next, avvisoDiario: avviso, edificioBuffId };
}

export type SnapshotDisordine = {
  fase: FaseDisordine;
  quotaOstili: number;
  numOstili: number;
  popolazione: number;
  avanzataDaProtesta: boolean;
};

/**
 * Protesta dal 5% Ostili; Ribellione dal 10%.
 * La ribellione richiede di aver già avuto protesta (o quota ≥ 10% forza comunque).
 */
export function valutaFaseDisordine(
  faseCorrente: FaseDisordine,
  abitanti: Abitante[],
  edifici: Edificio[],
  giornoGioco: number,
  mese: number,
  anno: number
): SnapshotDisordine {
  const popolazione = abitanti.filter((a) => a.id !== 1 && a.razza !== "Golem").length;
  if (popolazione <= 0) {
    return { fase: "nessuna", quotaOstili: 0, numOstili: 0, popolazione: 0, avanzataDaProtesta: false };
  }

  let numOstili = 0;
  for (const a of abitanti) {
    if (a.id === 1 || a.razza === "Golem") continue;
    const f = fasciaDaPunteggio(calcolaPunteggioSoddisfazione(a, edifici, giornoGioco, mese, anno));
    if (f === "Ostile") numOstili += 1;
  }
  const quota = numOstili / popolazione;

  let fase: FaseDisordine = "nessuna";
  let avanzata = false;
  if (quota >= SOGLIA_RIBELLIONE_OSTILI) {
    fase = "ribellione";
    avanzata = faseCorrente !== "ribellione";
  } else if (quota >= SOGLIA_PROTESTA_OSTILI) {
    fase = "protesta";
    avanzata = faseCorrente === "nessuna";
  } else {
    fase = "nessuna";
  }

  return { fase, quotaOstili: quota, numOstili, popolazione, avanzataDaProtesta: avanzata };
}

export function messaggioFaseDisordine(s: SnapshotDisordine): string | null {
  if (!s.avanzataDaProtesta) return null;
  if (s.fase === "protesta") {
    return `Proteste nel regno: ${s.numOstili} abitanti Ostili (${Math.round(s.quotaOstili * 100)}%). Scioperi e tensioni in aumento.`;
  }
  if (s.fase === "ribellione") {
    return `Ribellione! Il ${Math.round(s.quotaOstili * 100)}% della popolazione è Ostile. Il regno è in pericolo.`;
  }
  return null;
}

export function setModalitaRePuro(
  stato: StatoRePolitica,
  modalita: ModalitaRe,
  edificioVisitaReId?: number | null
): StatoRePolitica {
  if (modalita === "in_visita") {
    return {
      ...stato,
      modalitaRe: "in_visita",
      edificioVisitaReId: edificioVisitaReId ?? stato.edificioVisitaReId
    };
  }
  return {
    ...stato,
    modalitaRe: modalita,
    edificioVisitaReId: null
  };
}

export function contaPerFascia(
  abitanti: Abitante[],
  edifici: Edificio[],
  giornoGioco: number,
  mese: number,
  anno: number
): Record<FasciaSoddisfazione, number> {
  const out: Record<FasciaSoddisfazione, number> = {
    Devoto: 0,
    Soddisfatto: 0,
    Neutrale: 0,
    Insoddisfatto: 0,
    Ostile: 0
  };
  for (const a of abitanti) {
    if (a.id === 1 || a.razza === "Golem") continue;
    const f = fasciaDaPunteggio(calcolaPunteggioSoddisfazione(a, edifici, giornoGioco, mese, anno));
    out[f] += 1;
  }
  return out;
}
