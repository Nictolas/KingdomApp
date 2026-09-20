import type { Abitante, Edificio } from "../types";
import { ID_GIOCATORE } from "./schiavituCommercio";
import { numGuardieNelCastello, trovaCastelloOperativo } from "./castelloGuardie";
import {
  applicaLuttoFamiliareERimuoviMorti,
  azioneProbabileSeOstile,
  calcolaPunteggioSoddisfazione,
  fasciaDaPunteggio
} from "./soddisfazione";

export type FaseDisordineSoddisfazione = "nessuna" | "protesta" | "ribellione";

export const SOGLIA_PROTESTA_OSTILI = 0.05;
export const SOGLIA_RIBELLIONE_OSTILI = 0.1;

export type SnapshotDisordineSoddisfazione = {
  fase: FaseDisordineSoddisfazione;
  quotaOstili: number;
  numOstili: number;
  popolazione: number;
  avanzata: boolean;
};

export function valutaFaseDisordineSoddisfazione(
  faseCorrente: FaseDisordineSoddisfazione,
  abitanti: Abitante[],
  edifici: Edificio[],
  giornoGioco: number,
  mese: number,
  anno: number
): SnapshotDisordineSoddisfazione {
  const popolazione = abitanti.filter((a) => a.id !== 1 && a.razza !== "Golem").length;
  if (popolazione <= 0) {
    return {
      fase: "nessuna",
      quotaOstili: 0,
      numOstili: 0,
      popolazione: 0,
      avanzata: false
    };
  }

  let numOstili = 0;
  for (const abitante of abitanti) {
    if (abitante.id === 1 || abitante.razza === "Golem") continue;
    const punti = calcolaPunteggioSoddisfazione(
      abitante,
      edifici,
      giornoGioco,
      mese,
      anno
    );
    if (fasciaDaPunteggio(punti) === "Ostile") numOstili += 1;
  }

  const quotaOstili = numOstili / popolazione;
  let fase: FaseDisordineSoddisfazione = "nessuna";

  if (quotaOstili >= SOGLIA_RIBELLIONE_OSTILI) fase = "ribellione";
  else if (quotaOstili >= SOGLIA_PROTESTA_OSTILI) fase = "protesta";

  return {
    fase,
    quotaOstili,
    numOstili,
    popolazione,
    avanzata:
      fase !== "nessuna" &&
      fase !== faseCorrente &&
      !(faseCorrente === "ribellione" && fase === "protesta")
  };
}

export function messaggioFaseDisordineSoddisfazione(
  snapshot: SnapshotDisordineSoddisfazione
): string | null {
  if (!snapshot.avanzata) return null;
  const percentuale = Math.round(snapshot.quotaOstili * 100);

  if (snapshot.fase === "protesta") {
    return `Proteste nel regno: ${snapshot.numOstili} abitanti Ostili (${percentuale}%). Scioperi e tensioni in aumento.`;
  }
  if (snapshot.fase === "ribellione") {
    return `Ribellione! Il ${percentuale}% della popolazione è Ostile. Il regno è in pericolo.`;
  }
  return null;
}


export type RisultatoSabotaggioOstile = {
  edifici: Edificio[];
  sabotatoreId: number | null;
  edificioId: number | null;
  messaggio: string | null;
};

/**
 * Recupera il vandalismo storico come conseguenza individuale degli Ostili
 * predisposti al sabotaggio. Al massimo un edificio per cambio mese:
 * -8 efficienza, minimo 40. Castello e Residenze non sono bersagli.
 */
export function applicaSabotaggioOstileMensile(
  abitanti: Abitante[],
  edifici: Edificio[],
  giornoGioco: number,
  mese: number,
  anno: number,
  rng: () => number = Math.random
): RisultatoSabotaggioOstile {
  const candidati = abitanti.filter((abitante) => {
    if (abitante.id === 1 || abitante.razza === "Golem") return false;
    const punti = calcolaPunteggioSoddisfazione(
      abitante,
      edifici,
      giornoGioco,
      mese,
      anno
    );
    const fascia = fasciaDaPunteggio(punti);
    return azioneProbabileSeOstile(abitante, fascia) === "sabotaggio";
  });

  const bersagli = edifici.filter(
    (edificio) =>
      edificio.stato === "Operativo" &&
      edificio.nome !== "Castello" &&
      edificio.tipo !== "Residenza"
  );

  if (candidati.length === 0 || bersagli.length === 0) {
    return {
      edifici,
      sabotatoreId: null,
      edificioId: null,
      messaggio: null
    };
  }

  const sabotatore = candidati[Math.floor(rng() * candidati.length)]!;
  const bersaglio = bersagli[Math.floor(rng() * bersagli.length)]!;
  const nuovaEfficienza = Math.max(40, bersaglio.efficienza - 8);
  const aggiornati = edifici.map((edificio) =>
    edificio.id === bersaglio.id
      ? { ...edificio, efficienza: nuovaEfficienza }
      : edificio
  );

  return {
    edifici: aggiornati,
    sabotatoreId: sabotatore.id,
    edificioId: bersaglio.id,
    messaggio:
      `Sabotaggio: ${sabotatore.nome} ha colpito ${bersaglio.nome} ` +
      `(efficienza ${bersaglio.efficienza}→${nuovaEfficienza}).`
  };
}


export type RisultatoScomparsaOstile = {
  abitanti: Abitante[];
  edifici: Edificio[];
  scomparsoId: number | null;
  messaggio: string | null;
};

/**
 * Conseguenza individuale minima per un Ostile con azione «scomparsa».
 * Al massimo un abitante per cambio mese. Non è una morte: nessun lutto.
 */
export function applicaScomparsaOstileMensile(
  abitanti: Abitante[],
  edifici: Edificio[],
  giornoGioco: number,
  mese: number,
  anno: number,
  rng: () => number = Math.random
): RisultatoScomparsaOstile {
  const candidati = abitanti.filter((abitante) => {
    if (abitante.id === 1 || abitante.razza === "Golem") return false;
    const punti = calcolaPunteggioSoddisfazione(
      abitante,
      edifici,
      giornoGioco,
      mese,
      anno
    );
    const fascia = fasciaDaPunteggio(punti);
    return azioneProbabileSeOstile(abitante, fascia) === "scomparsa";
  });

  if (candidati.length === 0) {
    return { abitanti, edifici, scomparsoId: null, messaggio: null };
  }

  const scomparso = candidati[Math.floor(rng() * candidati.length)]!;
  const id = scomparso.id;

  const superstiti = abitanti
    .filter((abitante) => abitante.id !== id)
    .map((abitante) => {
      const amici = (abitante.amici ?? []).filter((r) => r.id !== id);
      const rivali = (abitante.rivali ?? []).filter((r) => r.id !== id);
      const figliIds = (abitante.figliIds ?? []).filter((x) => x !== id);
      const genitoriIds = (abitante.genitoriIds ?? []).filter((x) => x !== id);
      const nonniIds = (abitante.nonniIds ?? []).filter((x) => x !== id);

      return {
        ...abitante,
        amici,
        rivali,
        ...(abitante.coniugeId === id ? { coniugeId: undefined } : {}),
        ...(abitante.figliIds ? { figliIds } : {}),
        ...(abitante.genitoriIds ? { genitoriIds } : {}),
        ...(abitante.nonniIds ? { nonniIds } : {})
      };
    });

  const edificiAggiornati = edifici.map((edificio) => {
    const assegnati = (edificio.abitantiAssegnati ?? []).filter((x) => x !== id);
    if (assegnati.length === (edificio.abitantiAssegnati?.length ?? 0)) return edificio;
    return {
      ...edificio,
      abitantiAssegnati: assegnati,
      occupazione: assegnati.length
    };
  });

  return {
    abitanti: superstiti,
    edifici: edificiAggiornati,
    scomparsoId: id,
    messaggio: `Scomparsa: ${scomparso.nome} è sparito dal Regno senza lasciare tracce.`
  };
}


export type EsitoAttentatoOstile =
  | { tipo: "nessuno"; messaggio: null }
  | { tipo: "sventato"; attentatoreId: number; messaggio: string }
  | { tipo: "ferito"; attentatoreId: number; saluteRe: number; messaggio: string }
  | { tipo: "mortale"; attentatoreId: number; messaggio: string };

export function tentaAttentatoOstileMensile(
  abitanti: Abitante[],
  edifici: Edificio[],
  giornoGioco: number,
  mese: number,
  anno: number,
  rng: () => number = Math.random
): { abitanti: Abitante[]; esito: EsitoAttentatoOstile } {
  const candidati = abitanti.filter((abitante) => {
    if (abitante.id === ID_GIOCATORE || abitante.razza === "Golem") return false;
    const punti = calcolaPunteggioSoddisfazione(
      abitante,
      edifici,
      giornoGioco,
      mese,
      anno
    );
    const fascia = fasciaDaPunteggio(punti);
    return azioneProbabileSeOstile(abitante, fascia) === "attentato";
  });

  if (candidati.length === 0) {
    return { abitanti, esito: { tipo: "nessuno", messaggio: null } };
  }

  const probabilita = Math.min(0.55, 0.12 + (candidati.length - 1) * 0.08);
  if (rng() >= probabilita) {
    return { abitanti, esito: { tipo: "nessuno", messaggio: null } };
  }

  const attentatore = candidati[Math.floor(rng() * candidati.length)]!;
  const castello = trovaCastelloOperativo(edifici);
  const guardie = castello ? numGuardieNelCastello(castello, ID_GIOCATORE, abitanti) : 0;

  if (guardie >= 3 || rng() < 0.45) {
    return {
      abitanti,
      esito: {
        tipo: "sventato",
        attentatoreId: attentatore.id,
        messaggio: `Attentato sventato: ${attentatore.nome} ha cercato di colpire il Re.`
      }
    };
  }

  const re = abitanti.find((abitante) => abitante.id === ID_GIOCATORE);
  if (!re) {
    return { abitanti, esito: { tipo: "nessuno", messaggio: null } };
  }

  if (re.salute < 40 && rng() < 0.25) {
    return {
      abitanti: abitanti.map((abitante) =>
        abitante.id === ID_GIOCATORE ? { ...abitante, salute: 0 } : abitante
      ),
      esito: {
        tipo: "mortale",
        attentatoreId: attentatore.id,
        messaggio: `Il Re è stato assassinato da ${attentatore.nome}.`
      }
    };
  }

  const saluteRe = Math.max(1, re.salute - 35);
  return {
    abitanti: abitanti.map((abitante) =>
      abitante.id === ID_GIOCATORE ? { ...abitante, salute: saluteRe } : abitante
    ),
    esito: {
      tipo: "ferito",
      attentatoreId: attentatore.id,
      saluteRe,
      messaggio: `Attentato: ${attentatore.nome} ha ferito il Re (salute ${saluteRe}).`
    }
  };
}


export type RisultatoRibellioneMensile = {
  moneteGiocatore: number;
  abitanti: Abitante[];
  edifici: Edificio[];
  messaggi: string[];
};

/** Effetti storici della fase Ribellione (quota Ostili >= 10%). */
export function applicaEffettiRibellioneMensile(
  fase: FaseDisordineSoddisfazione,
  moneteGiocatore: number,
  abitanti: Abitante[],
  edifici: Edificio[],
  rng: () => number = Math.random
): RisultatoRibellioneMensile {
  if (fase !== "ribellione") {
    return { moneteGiocatore, abitanti, edifici, messaggi: [] };
  }

  let monete = moneteGiocatore;
  let nextAbitanti = [...abitanti];
  let nextEdifici = edifici.map((edificio) => ({ ...edificio }));
  const messaggi: string[] = [];

  const perdita = Math.max(40, Math.floor(monete * 0.18));
  const tolto = Math.min(monete, perdita);
  monete -= tolto;
  if (tolto > 0) {
    messaggi.push(`Ribellione: saccheggi e caos (−${tolto} monete).`);
  }

  const bersagli = nextEdifici.filter(
    (edificio) => edificio.stato === "Operativo" && edificio.nome !== "Castello"
  );
  if (bersagli.length > 0) {
    const bersaglio = bersagli[Math.floor(rng() * bersagli.length)]!;
    const indice = nextEdifici.findIndex((edificio) => edificio.id === bersaglio.id);
    if (indice >= 0) {
      const efficienza = Math.max(30, bersaglio.efficienza - 15);
      const danneggiato = rng() < 0.35;
      nextEdifici[indice] = {
        ...bersaglio,
        efficienza,
        ...(danneggiato ? { stato: "Danneggiato" as const } : {})
      };
      messaggi.push(
        danneggiato
          ? `Assalto a ${bersaglio.nome}: edificio danneggiato.`
          : `Assalto a ${bersaglio.nome}: efficienza ${bersaglio.efficienza}→${efficienza}.`
      );
    }
  }

  const civili = nextAbitanti.filter(
    (abitante) => abitante.id !== ID_GIOCATORE && abitante.razza !== "Golem"
  );
  const nVittime = civili.length === 0 ? 0 : rng() < 0.55 ? 1 : rng() < 0.25 ? 2 : 0;

  if (nVittime > 0) {
    const idsMorti = new Set<number>();
    const pool = [...civili];

    for (let i = 0; i < nVittime && pool.length > 0; i++) {
      const indice = Math.floor(rng() * pool.length);
      idsMorti.add(pool[indice]!.id);
      pool.splice(indice, 1);
    }

    const nomi = nextAbitanti
      .filter((abitante) => idsMorti.has(abitante.id))
      .map((abitante) => abitante.nome);

    nextAbitanti = applicaLuttoFamiliareERimuoviMorti(nextAbitanti, idsMorti);
    nextEdifici = nextEdifici.map((edificio) => {
      const assegnati = (edificio.abitantiAssegnati ?? []).filter(
        (id) => !idsMorti.has(id)
      );
      return assegnati.length !== (edificio.abitantiAssegnati?.length ?? 0)
        ? { ...edificio, abitantiAssegnati: assegnati, occupazione: assegnati.length }
        : edificio;
    });

    messaggi.push(`Scontri durante la Ribellione: morti ${nomi.join(", ")}.`);
  }

  return {
    moneteGiocatore: Math.max(0, monete),
    abitanti: nextAbitanti,
    edifici: nextEdifici,
    messaggi
  };
}


export type RisultatoProtestaMensile = {
  moneteGiocatore: number;
  messaggi: string[];
};

/**
 * Effetto economico storico della fase Protesta.
 * Il vandalismo -8 efficienza non viene duplicato qui perché è già coperto
 * dal sabotaggio individuale degli Ostili.
 */
export function applicaEffettiProtestaMensile(
  fase: FaseDisordineSoddisfazione,
  moneteGiocatore: number
): RisultatoProtestaMensile {
  if (fase !== "protesta") {
    return { moneteGiocatore, messaggi: [] };
  }

  const perdita = Math.max(15, Math.floor(moneteGiocatore * 0.08));
  const tolto = Math.min(moneteGiocatore, perdita);

  return {
    moneteGiocatore: Math.max(0, moneteGiocatore - tolto),
    messaggi:
      tolto > 0
        ? [`Proteste: scioperi e tasse non pagate (−${tolto} monete).`]
        : []
  };
}
