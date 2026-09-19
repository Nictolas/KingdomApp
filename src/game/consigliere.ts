import type { Abitante, Edificio } from "../types";
import { ID_GIOCATORE, isGiocatore } from "./schiavituCommercio";
import { NOME_CASTELLO } from "./castelloGuardie";

export const LAVORO_CONSIGLIERE = "Consigliere";

/** Trova l’abitante con occupazione Consigliere. */
export function trovaConsigliere(abitanti: Abitante[]): Abitante | undefined {
  return abitanti.find((a) => a.lavoro === LAVORO_CONSIGLIERE && !isGiocatore(a));
}

export function èConsigliere(abitante: Abitante | undefined | null): boolean {
  return !!abitante && abitante.lavoro === LAVORO_CONSIGLIERE && !isGiocatore(abitante);
}

/** Id idonei a diventare Consigliere (non Re, non Golem, non già ruoli bloccati). */
export function candidatiConsigliere(abitanti: Abitante[], esclusoId?: number | null): Abitante[] {
  return abitanti.filter((a) => {
    if (isGiocatore(a)) return false;
    if (esclusoId != null && a.id === esclusoId) return false;
    if (a.razza === "Golem") return false;
    if (a.lavoro === "Prigioniero" || a.lavoro === "Pensionato") return false;
    if (a.lavoro === "Capo Religioso" || a.lavoro === "Capo Spirituale") return false;
    if (a.lavoro === LAVORO_CONSIGLIERE) return false;
    return true;
  });
}

/**
 * Nomina un nuovo Consigliere: rimuove il precedente dal Castello (→ Disoccupato + Capanna),
 * assegna il nuovo al Castello con lavoro Consigliere e lo toglie dalle residenze.
 */
export function nominaConsigliere(
  abitanti: Abitante[],
  edifici: Edificio[],
  nuovoId: number
): { abitanti: Abitante[]; edifici: Edificio[]; ok: boolean } {
  const nuovo = abitanti.find((a) => a.id === nuovoId);
  if (!nuovo || isGiocatore(nuovo) || nuovo.razza === "Golem") {
    return { abitanti, edifici, ok: false };
  }
  if (
    nuovo.lavoro === "Prigioniero" ||
    nuovo.lavoro === "Pensionato" ||
    nuovo.lavoro === "Capo Religioso" ||
    nuovo.lavoro === "Capo Spirituale"
  ) {
    return { abitanti, edifici, ok: false };
  }

  const precedente = trovaConsigliere(abitanti);
  const prevId = precedente?.id ?? null;

  const edificiNext = edifici.map((e) => {
    let ids = [...(e.abitantiAssegnati ?? [])];
    let changed = false;

    if (e.nome === NOME_CASTELLO || e.id === 1) {
      if (prevId != null && ids.includes(prevId)) {
        ids = ids.filter((id) => id !== prevId);
        changed = true;
      }
      if (!ids.includes(nuovoId)) {
        ids = [...ids.filter((id) => id !== ID_GIOCATORE), nuovoId];
        ids = [ID_GIOCATORE, ...ids.filter((id) => id !== ID_GIOCATORE)];
        changed = true;
      }
    } else if (e.tipo === "Residenza") {
      if (ids.includes(nuovoId)) {
        ids = ids.filter((id) => id !== nuovoId);
        changed = true;
      }
      if (prevId != null && e.nome === "Capanna" && !ids.includes(prevId)) {
        ids = [...ids, prevId];
        changed = true;
      }
    }

    if (!changed) return e;
    return { ...e, abitantiAssegnati: ids, occupazione: ids.length };
  });

  const abitantiNext = abitanti.map((a) => {
    if (prevId != null && a.id === prevId) {
      return { ...a, lavoro: "Disoccupato" };
    }
    if (a.id === nuovoId) {
      return { ...a, lavoro: LAVORO_CONSIGLIERE };
    }
    return a;
  });

  return { abitanti: abitantiNext, edifici: edificiNext, ok: true };
}
