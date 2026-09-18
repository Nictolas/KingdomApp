import type { Abitante, RelazionePunteggio } from "../types";

export type CanaleRelazione = "amici" | "rivali";

export type EsitoChiacchiera =
  | { tipo: "nessuno" }
  | { tipo: "creata"; canale: CanaleRelazione; punteggio: number }
  | {
      tipo: "modificata";
      canale: CanaleRelazione;
      delta: number;
      punteggio: number;
      flip: boolean;
    };

function razzaDi(a: Abitante): string {
  return a.razza ?? "Umano";
}

function èOmoOBi(a: Abitante): boolean {
  return a.orientamento === "Omo" || a.orientamento === "Bi";
}

/** Omofobo vs Omo/Bi, oppure Razzista vs razza diversa (come in avanzaMese). */
export function coppiaConPregiudizioChiacchiera(a: Abitante, b: Abitante): boolean {
  const omofobo =
    (a.personalità === "Omofobo" && èOmoOBi(b)) || (b.personalità === "Omofobo" && èOmoOBi(a));
  const razzista =
    (a.personalità === "Razzista" || b.personalità === "Razzista") && razzaDi(a) !== razzaDi(b);
  return omofobo || razzista;
}

function cloneRel(list: RelazionePunteggio[] | undefined): RelazionePunteggio[] {
  return (list ?? []).map((r) => ({ ...r }));
}

function findRel(list: RelazionePunteggio[], otherId: number): RelazionePunteggio | undefined {
  return list.find((r) => r.id === otherId);
}

function removeRel(list: RelazionePunteggio[], otherId: number): RelazionePunteggio[] {
  return list.filter((r) => r.id !== otherId);
}

function upsertRel(
  list: RelazionePunteggio[],
  otherId: number,
  punteggio: number
): RelazionePunteggio[] {
  const next = list.filter((r) => r.id !== otherId);
  next.push({ id: otherId, punteggio: Math.max(1, Math.min(100, punteggio)) });
  return next;
}

function setCanaleSimmetrico(
  a: Abitante,
  b: Abitante,
  canale: CanaleRelazione,
  punteggio: number
): { a: Abitante; b: Abitante } {
  const amiciA = cloneRel(a.amici);
  const rivaliA = cloneRel(a.rivali);
  const amiciB = cloneRel(b.amici);
  const rivaliB = cloneRel(b.rivali);
  if (canale === "amici") {
    return {
      a: {
        ...a,
        amici: upsertRel(removeRel(amiciA, b.id), b.id, punteggio),
        rivali: removeRel(rivaliA, b.id)
      },
      b: {
        ...b,
        amici: upsertRel(removeRel(amiciB, a.id), a.id, punteggio),
        rivali: removeRel(rivaliB, a.id)
      }
    };
  }
  return {
    a: {
      ...a,
      rivali: upsertRel(removeRel(rivaliA, b.id), b.id, punteggio),
      amici: removeRel(amiciA, b.id)
    },
    b: {
      ...b,
      rivali: upsertRel(removeRel(rivaliB, a.id), a.id, punteggio),
      amici: removeRel(amiciB, a.id)
    }
  };
}

function randInt(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Esito sociale di una chiacchiera «in giro».
 * - Nessuna relazione: si crea sempre (amicizia o rivalità a 10).
 * - Relazione già presente: ~60% migliora/peggiora (o flip se ≤0).
 * - Pregiudizio Omofobo/Razzista: spinge forte sulla rivalità.
 */
export function applicaEsitoChiacchiera(
  a: Abitante,
  b: Abitante,
  rng: () => number = Math.random
): { a: Abitante; b: Abitante; esito: EsitoChiacchiera } {
  const pregiudizio = coppiaConPregiudizioChiacchiera(a, b);
  const amiciA = a.amici ?? [];
  const rivaliA = a.rivali ?? [];
  const amicizia = findRel(amiciA, b.id);
  const rivalita = findRel(rivaliA, b.id);
  const senzaRelazione = !amicizia && !rivalita;

  if (pregiudizio) {
    // 80% applica rivalità; 20% nessun effetto (solo se già esiste un rapporto).
    if (!senzaRelazione && rng() > 0.8) return { a, b, esito: { tipo: "nessuno" } };

    const delta = randInt(4, 8, rng);
    if (rivalita) {
      const punteggio = Math.min(100, rivalita.punteggio + delta);
      const next = setCanaleSimmetrico(a, b, "rivali", punteggio);
      return {
        ...next,
        esito: { tipo: "modificata", canale: "rivali", delta, punteggio, flip: false }
      };
    }
    if (amicizia) {
      const next = setCanaleSimmetrico(a, b, "rivali", 10);
      return {
        ...next,
        esito: {
          tipo: "modificata",
          canale: "rivali",
          delta: -amicizia.punteggio,
          punteggio: 10,
          flip: true
        }
      };
    }
    const next = setCanaleSimmetrico(a, b, "rivali", 10);
    return { ...next, esito: { tipo: "creata", canale: "rivali", punteggio: 10 } };
  }

  // Prima chiacchiera: nasce sempre una relazione.
  if (senzaRelazione) {
    const canale: CanaleRelazione = rng() < 0.6 ? "amici" : "rivali";
    const next = setCanaleSimmetrico(a, b, canale, 10);
    return { ...next, esito: { tipo: "creata", canale, punteggio: 10 } };
  }

  // Già legati: a volte il rapporto non cambia.
  if (rng() > 0.6) return { a, b, esito: { tipo: "nessuno" } };

  const canale: CanaleRelazione = amicizia ? "amici" : "rivali";
  const punteggio = (amicizia ?? rivalita)!.punteggio;
  const delta = randInt(-8, 8, rng);
  const nuovo = punteggio + delta;

  if (nuovo <= 0) {
    const altro: CanaleRelazione = canale === "amici" ? "rivali" : "amici";
    const next = setCanaleSimmetrico(a, b, altro, 10);
    return {
      ...next,
      esito: { tipo: "modificata", canale: altro, delta, punteggio: 10, flip: true }
    };
  }

  const next = setCanaleSimmetrico(a, b, canale, Math.min(100, nuovo));
  return {
    ...next,
    esito: {
      tipo: "modificata",
      canale,
      delta,
      punteggio: Math.min(100, nuovo),
      flip: false
    }
  };
}

/** Applica l’esito su una lista di abitanti (update atomico). */
export function applicaEsitoChiacchieraSuLista(
  abitanti: readonly Abitante[],
  idA: number,
  idB: number,
  rng: () => number = Math.random
): Abitante[] {
  const a = abitanti.find((x) => x.id === idA);
  const b = abitanti.find((x) => x.id === idB);
  if (!a || !b || idA === idB) return abitanti as Abitante[];
  const { a: nextA, b: nextB, esito } = applicaEsitoChiacchiera(a, b, rng);
  if (esito.tipo === "nessuno") return abitanti as Abitante[];
  return abitanti.map((x) => (x.id === idA ? nextA : x.id === idB ? nextB : x));
}
