/**
 * Effetti mensili di protesta/ribellione e attentati al Re.
 */

import type { Abitante, Edificio } from "../types";
import { ID_GIOCATORE } from "./schiavituCommercio";
import {
  calcolaPunteggioSoddisfazione,
  fasciaDaPunteggio,
  azioneProbabileSeOstile,
  applicaLuttoFamiliareERimuoviMorti
} from "./soddisfazione";
import {
  type FaseDisordine,
  type ModalitaRe,
  type StatoRePolitica,
  BONUS_PRODUZIONE_VISITA,
  clampPopolarita,
  vulnerabileAttentato
} from "./reModalita";

/** Id edificio con buff produzione se il Re è in visita su un edificio operativo. */
export function edificioBuffVisitaCorrente(
  stato: Pick<StatoRePolitica, "modalitaRe" | "edificioVisitaReId">,
  edifici: Edificio[]
): number | null {
  if (stato.modalitaRe !== "in_visita") return null;
  const id = stato.edificioVisitaReId;
  if (id == null) return null;
  const e = edifici.find((x) => x.id === id && x.stato === "Operativo");
  return e ? id : null;
}

export function applicaMoltiplicatoreProduzione(quantità: number, buff: boolean): number {
  if (!buff || quantità <= 0) return quantità;
  return Math.floor(quantità * BONUS_PRODUZIONE_VISITA);
}

export type EffettiDisordineResult = {
  moneteGiocatore: number;
  abitanti: Abitante[];
  edifici: Edificio[];
  popolaritaDelta: number;
  messaggi: string[];
};

/**
 * Protesta: sottrae monete (evasione/scioperi), cala efficienza 1 edificio.
 * Ribellione: danni più gravi + possibili vittime civili.
 */
export function applicaEffettiDisordineMensile(
  fase: FaseDisordine,
  moneteGiocatore: number,
  abitanti: Abitante[],
  edifici: Edificio[],
  rng: () => number = Math.random
): EffettiDisordineResult {
  if (fase === "nessuna") {
    return { moneteGiocatore, abitanti, edifici, popolaritaDelta: 0, messaggi: [] };
  }

  let monete = moneteGiocatore;
  let nextAbitanti = [...abitanti];
  let nextEdifici = edifici.map((e) => ({ ...e }));
  const messaggi: string[] = [];
  let popolaritaDelta = 0;

  if (fase === "protesta") {
    const prelievo = Math.max(15, Math.floor(monete * 0.08));
    const tolto = Math.min(monete, prelievo);
    monete -= tolto;
    if (tolto > 0) {
      messaggi.push(`Proteste: scioperi e tasse non pagate (−${tolto} monete).`);
    }
    const bersagli = nextEdifici.filter(
      (e) => e.stato === "Operativo" && e.nome !== "Castello" && e.tipo !== "Residenza"
    );
    if (bersagli.length > 0) {
      const e = bersagli[Math.floor(rng() * bersagli.length)]!;
      const idx = nextEdifici.findIndex((x) => x.id === e.id);
      if (idx >= 0) {
        const eff = Math.max(40, e.efficienza - 8);
        nextEdifici[idx] = { ...e, efficienza: eff };
        messaggi.push(`Vandalismo a ${e.nome}: efficienza ${e.efficienza}→${eff}.`);
      }
    }
    popolaritaDelta = -2;
  } else if (fase === "ribellione") {
    const prelievo = Math.max(40, Math.floor(monete * 0.18));
    const tolto = Math.min(monete, prelievo);
    monete -= tolto;
    if (tolto > 0) {
      messaggi.push(`Ribellione: saccheggi e caos (−${tolto} monete).`);
    }
    const bersagli = nextEdifici.filter(
      (e) => e.stato === "Operativo" && e.nome !== "Castello"
    );
    if (bersagli.length > 0) {
      const e = bersagli[Math.floor(rng() * bersagli.length)]!;
      const idx = nextEdifici.findIndex((x) => x.id === e.id);
      if (idx >= 0) {
        const eff = Math.max(30, e.efficienza - 15);
        nextEdifici[idx] = {
          ...e,
          efficienza: eff,
          ...(rng() < 0.35 ? { stato: "Danneggiato" as const } : {})
        };
        messaggi.push(
          nextEdifici[idx]!.stato === "Danneggiato"
            ? `Assalto a ${e.nome}: edificio danneggiato.`
            : `Assalto a ${e.nome}: efficienza ${e.efficienza}→${eff}.`
        );
      }
    }
    // Vittime civili (non Re)
    const pool = nextAbitanti.filter((a) => a.id !== ID_GIOCATORE && a.razza !== "Golem");
    const nVittime = pool.length === 0 ? 0 : rng() < 0.55 ? 1 : rng() < 0.25 ? 2 : 0;
    if (nVittime > 0) {
      const ids = new Set<number>();
      const copia = [...pool];
      for (let i = 0; i < nVittime && copia.length > 0; i++) {
        const j = Math.floor(rng() * copia.length);
        ids.add(copia[j]!.id);
        copia.splice(j, 1);
      }
      const nomi = nextAbitanti.filter((a) => ids.has(a.id)).map((a) => a.nome);
      nextAbitanti = applicaLuttoFamiliareERimuoviMorti(nextAbitanti, ids);
      nextEdifici = nextEdifici.map((e) => {
        const nuovi = (e.abitantiAssegnati ?? []).filter((id) => !ids.has(id));
        return nuovi.length !== (e.abitantiAssegnati?.length ?? 0)
          ? { ...e, abitantiAssegnati: nuovi, occupazione: nuovi.length }
          : e;
      });
      messaggi.push(`Scontri: morti ${nomi.join(", ")}.`);
    }
    popolaritaDelta = -6;
  }

  return {
    moneteGiocatore: Math.max(0, monete),
    abitanti: nextAbitanti,
    edifici: nextEdifici,
    popolaritaDelta,
    messaggi
  };
}

export type EsitoAttentato =
  | { tipo: "nessuno" }
  | { tipo: "sventato"; nomeAttentatore: string }
  | { tipo: "ferito"; nomeAttentatore: string; saluteRe: number }
  | { tipo: "mortale"; nomeAttentatore: string };

export type TentativoAttentatoInput = {
  abitanti: Abitante[];
  edifici: Edificio[];
  modalitaRe: ModalitaRe;
  giornoGioco: number;
  mese: number;
  anno: number;
  rng?: () => number;
};

/**
 * Solo se il Re è esposto (a giro / in visita).
 * Candidati: Ostili con azione «attentato». Caserma 3+ mitiga.
 */
export function tentaAttentatoAlRe(input: TentativoAttentatoInput): {
  esito: EsitoAttentato;
  abitanti: Abitante[];
} {
  const rng = input.rng ?? Math.random;
  if (!vulnerabileAttentato(input.modalitaRe)) {
    return { esito: { tipo: "nessuno" }, abitanti: input.abitanti };
  }

  const candidati = input.abitanti.filter((a) => {
    if (a.id === ID_GIOCATORE || a.razza === "Golem") return false;
    const fascia = fasciaDaPunteggio(
      calcolaPunteggioSoddisfazione(a, input.edifici, input.giornoGioco, input.mese, input.anno)
    );
    return azioneProbabileSeOstile(a, fascia) === "attentato";
  });
  if (candidati.length === 0) {
    return { esito: { tipo: "nessuno" }, abitanti: input.abitanti };
  }

  // Probabilità cumulativa: 12% base + 8% per attentatore oltre il primo
  const pTentativo = Math.min(0.55, 0.12 + (candidati.length - 1) * 0.08);
  if (rng() >= pTentativo) {
    return { esito: { tipo: "nessuno" }, abitanti: input.abitanti };
  }

  const attentatore = candidati[Math.floor(rng() * candidati.length)]!;
  const caserma = input.edifici.find((e) => e.nome === "Caserma");
  const guardie = caserma?.abitantiAssegnati?.length ?? 0;
  const mitigato = guardie >= 3;

  if (mitigato || rng() < 0.45) {
    return {
      esito: { tipo: "sventato", nomeAttentatore: attentatore.nome },
      abitanti: input.abitanti.map((a) =>
        a.id === attentatore.id
          ? { ...a, reati: [...(a.reati ?? []), "Omicidio" as const] }
          : a
      )
    };
  }

  const re = input.abitanti.find((a) => a.id === ID_GIOCATORE);
  if (!re) return { esito: { tipo: "nessuno" }, abitanti: input.abitanti };

  // 25% mortale se già ferito (salute < 40), altrimenti ferisce
  if (re.salute < 40 && rng() < 0.25) {
    const senzaRe = applicaLuttoFamiliareERimuoviMorti(input.abitanti, new Set([ID_GIOCATORE]));
    const edificiPuliti = input.edifici; // caller aggiorna edifici se serve
    void edificiPuliti;
    return {
      esito: { tipo: "mortale", nomeAttentatore: attentatore.nome },
      abitanti: senzaRe.map((a) =>
        a.id === attentatore.id
          ? { ...a, reati: [...(a.reati ?? []), "Omicidio" as const] }
          : a
      )
    };
  }

  const saluteRe = Math.max(1, re.salute - 35);
  return {
    esito: { tipo: "ferito", nomeAttentatore: attentatore.nome, saluteRe },
    abitanti: input.abitanti.map((a) => {
      if (a.id === ID_GIOCATORE) return { ...a, salute: saluteRe };
      if (a.id === attentatore.id) return { ...a, reati: [...(a.reati ?? []), "Omicidio" as const] };
      return a;
    })
  };
}

export function messaggioEsitoAttentato(esito: EsitoAttentato): string | null {
  switch (esito.tipo) {
    case "nessuno":
      return null;
    case "sventato":
      return `Attentato sventato: ${esito.nomeAttentatore} ha cercato di uccidere il Re.`;
    case "ferito":
      return `Attentato! ${esito.nomeAttentatore} ha ferito il Re (salute ${esito.saluteRe}).`;
    case "mortale":
      return `Il Re è stato assassinato da ${esito.nomeAttentatore}.`;
  }
}

export function applicaPopolaritaDelta(pop: number, delta: number): number {
  return clampPopolarita(pop + delta);
}

/** Il Re è “dentro” un edificio (non cammina sulla mappa). */
export function reNascostoInEdificio(modalita: ModalitaRe): boolean {
  return modalita === "nel_castello" || modalita === "in_visita";
}
