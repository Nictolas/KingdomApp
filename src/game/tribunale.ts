import type { Abitante, Edificio } from "../types";
import {
  calcolaAnniCarcereDaReati,
  messaggioReatoSenzaLegge,
  type PenaReatiConfig
} from "./reati";
import { applicaLuttoFamiliareERimuoviMorti } from "./soddisfazione";

export type RisultatoGiudizio =
  | { ok: false; messaggio: string }
  | { ok: true; messaggio: string; anni: number };

/**
 * Calcola i nuovi abitanti dopo la grazia di un imputato:
 * lui e amici +10% lealtà, rivali -10% lealtà, reati azzerati per il graziato.
 */
export function graziaCriminalePuro(abitanti: Abitante[], abitanteId: number): Abitante[] {
  const c = abitanti.find((a) => a.id === abitanteId);
  if (!c || !c.reati?.length) return abitanti;

  const idsBonus = new Set<number>([c.id, ...(c.amici ?? []).map((x) => x.id)]);
  const idsMalus = new Set<number>((c.rivali ?? []).map((x) => x.id));

  return abitanti.map((a) => {
    let lealtà = a.lealtà;
    if (idsBonus.has(a.id)) lealtà = Math.min(100, Math.round(a.lealtà * 1.1));
    if (idsMalus.has(a.id)) lealtà = Math.max(0, Math.round(a.lealtà * 0.9));
    const reati = a.id === abitanteId ? [] : a.reati;
    return { ...a, lealtà, reati: reati ?? a.reati };
  });
}

/** Restituisce abitanti ed edifici dopo la rimozione dell'abitante condannato a morte. */
export function condannaAMortePuro(
  abitanti: Abitante[],
  edifici: Edificio[],
  abitanteId: number
): { nuoviAbitanti: Abitante[]; nuoviEdifici: Edificio[] } {
  const nuoviAbitanti = applicaLuttoFamiliareERimuoviMorti(
    abitanti,
    new Set([abitanteId])
  );
  const nuoviEdifici = edifici.map((e) => {
    const nuovi = (e.abitantiAssegnati ?? []).filter((id) => id !== abitanteId);
    return nuovi.length !== (e.abitantiAssegnati?.length ?? 0)
      ? { ...e, abitantiAssegnati: nuovi, occupazione: nuovi.length }
      : e;
  });
  return { nuoviAbitanti, nuoviEdifici };
}

/** Valuta la sentenza del giudice senza modificare lo stato. */
export function valutaSentenzaGiudice(
  imputato: Abitante | undefined,
  giudicePresente: boolean,
  penaReati: PenaReatiConfig
): RisultatoGiudizio {
  if (!giudicePresente) {
    return { ok: false, messaggio: "Devi prima assegnare un Giudice" };
  }
  if (!imputato || !(imputato.reati?.length ?? 0)) {
    return { ok: false, messaggio: "Nessun reato da giudicare" };
  }

  const { anni, reatoSenzaLegge, nessunReatoPunibile } = calcolaAnniCarcereDaReati(
    imputato.reati,
    penaReati
  );

  if (reatoSenzaLegge) {
    return { ok: false, messaggio: messaggioReatoSenzaLegge(reatoSenzaLegge) };
  }
  if (nessunReatoPunibile) {
    return {
      ok: false,
      messaggio: "Configura le pene per Omicidio, Furto o Stupro nella pagina Reati"
    };
  }

  return {
    ok: true,
    anni,
    messaggio:
      anni > 0
        ? `Condannato a ${anni} ${anni === 1 ? "anno" : "anni"} di carcere`
        : "Assolto (pena zero per tutti i reati)"
  };
}

/** Invia un imputato al Campo di Lavoro come Prigioniero. */
export function condannaAlCampoDiLavoroPuro(
  abitanti: Abitante[],
  edifici: Edificio[],
  abitanteId: number,
  anniCarcere?: number
): { ok: boolean; messaggio: string; abitanti: Abitante[]; edifici: Edificio[] } {
  const imputato = abitanti.find((a) => a.id === abitanteId);
  if (!imputato || !(imputato.reati?.length ?? 0)) {
    return { ok: false, messaggio: "Nessun reato da giudicare", abitanti, edifici };
  }

  const campo = edifici.find((e) => e.nome === "Campo di Lavoro");
  if (!campo || campo.stato !== "Operativo") {
    return { ok: false, messaggio: "Campo di Lavoro non operativo", abitanti, edifici };
  }

  const giàNelCampo = (campo.abitantiAssegnati ?? []).includes(abitanteId);
  const postiLiberi = campo.capacità - (campo.abitantiAssegnati?.length ?? 0);
  if (!giàNelCampo && postiLiberi <= 0) {
    return { ok: false, messaggio: "Il Campo di Lavoro è al completo", abitanti, edifici };
  }

  const nuoviAbitanti = abitanti.map((a) => {
    if (a.id !== abitanteId) return a;
    const next: Abitante = {
      ...a,
      lavoro: "Prigioniero",
      reati: [],
      anniCarcereResidui: anniCarcere
    };
    if (anniCarcere === undefined) {
      delete next.anniCarcereResidui;
    }
    return next;
  });

  const nuoviEdifici = edifici.map((e) => {
    if (e.nome === "Campo di Lavoro") {
      if (giàNelCampo) return e;
      const nuovi = [...(e.abitantiAssegnati ?? []), abitanteId];
      return { ...e, abitantiAssegnati: nuovi, occupazione: nuovi.length };
    }
    const nuoviAssegnati = (e.abitantiAssegnati ?? []).filter((id) => id !== abitanteId);
    if (nuoviAssegnati.length === (e.abitantiAssegnati?.length ?? 0)) return e;
    return { ...e, abitantiAssegnati: nuoviAssegnati, occupazione: nuoviAssegnati.length };
  });

  const msg =
    anniCarcere != null && anniCarcere > 0
      ? `Condannato a ${anniCarcere} ${anniCarcere === 1 ? "anno" : "anni"} di carcere`
      : "Condannato ai lavori forzati";

  return { ok: true, messaggio: msg, abitanti: nuoviAbitanti, edifici: nuoviEdifici };
}

/** Decrementa il carcere residuo a ogni mese; libera chi ha finito la pena. */
export function avanzaCarcereResiduoPuro(
  abitanti: Abitante[],
  edifici: Edificio[]
): { abitanti: Abitante[]; edifici: Edificio[] } {
  const daLiberare = new Set<number>();
  const nextAbitanti = abitanti.map((a) => {
    if (a.anniCarcereResidui == null || a.anniCarcereResidui <= 0) return a;
    const residuo = a.anniCarcereResidui - 1;
    if (residuo <= 0) {
      daLiberare.add(a.id);
      const { anniCarcereResidui: _, ...rest } = a;
      return { ...rest, lavoro: "Disoccupato" };
    }
    return { ...a, anniCarcereResidui: residuo };
  });

  if (daLiberare.size === 0) return { abitanti: nextAbitanti, edifici };

  const nextEdifici = edifici.map((e) => {
    const nuovi = (e.abitantiAssegnati ?? []).filter((id) => !daLiberare.has(id));
    if (nuovi.length === (e.abitantiAssegnati?.length ?? 0)) return e;
    return { ...e, abitantiAssegnati: nuovi, occupazione: nuovi.length };
  });

  return { abitanti: nextAbitanti, edifici: nextEdifici };
}
