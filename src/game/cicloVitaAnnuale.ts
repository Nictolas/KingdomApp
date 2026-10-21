import type { Abitante, Edificio, Razza } from "../types";

/** Regole biologiche: i Golem non invecchiano naturalmente.
 * Il limite indica l'eta' alla quale la morte naturale e' certa, non un'eta' fissa per tutti.
 */
const LONGEVITA: Record<Exclude<Razza, "Golem">, { rischioDa: number; limite: number }> = {
  Umano: { rischioDa: 72, limite: 110 },
  Elfo: { rischioDa: 120, limite: 200 },
  Nano: { rischioDa: 95, limite: 145 },
  Orco: { rischioDa: 55, limite: 100 },
  Goblin: { rischioDa: 55, limite: 95 }
};

export type SovranoDefunto = { nome: string; eta: number; anno: number; causa: "vecchiaia" };
export type SuccessioneDinastica = {
  predecessore: string;
  erede: string;
  eredeMinorenne: boolean;
};

export function probabilitaMorteVecchiaia(
  eta: number,
  razza: Razza = "Umano",
  salute = 100
): number {
  if (razza === "Golem") return 0;
  const { rischioDa, limite } = LONGEVITA[razza];
  if (eta < rischioDa) return 0;
  if (eta >= limite) return 1;
  const avanzamento = (eta - rischioDa) / (limite - rischioDa);
  const saluteFragile = 1 + (100 - Math.max(0, Math.min(100, salute))) / 200;
  return Math.min(0.95, avanzamento ** 2 * 0.55 * saluteFragile);
}

export function faseVita(eta: number): "neonato" | "bambino" | "adolescente" | "adulto" {
  if (eta < 3) return "neonato";
  if (eta < 13) return "bambino";
  if (eta < 18) return "adolescente";
  return "adulto";
}

export function lavoroDopoCrescita(abitante: Abitante): string {
  const fase = faseVita(abitante.eta);
  if (fase === "neonato") return abitante.lavoro === "Neonato" ? "Neonato" : abitante.lavoro;
  if (fase === "bambino" && abitante.lavoro === "Neonato") return "Bambino";
  if (fase === "adolescente" && ["Neonato", "Bambino"].includes(abitante.lavoro)) return "Adolescente";
  if (fase === "adulto" && ["Neonato", "Bambino", "Adolescente"].includes(abitante.lavoro)) return "Disoccupato";
  return abitante.lavoro;
}

function scegliErede(re: Abitante, viventi: Abitante[]): Abitante | undefined {
  const diretti = viventi.filter(a =>
    a.id !== re.id &&
    ((re.figliIds ?? []).includes(a.id) ||
      (a.genitoriIds ?? []).includes(re.id) ||
      (a.genitoriAdottiviIds ?? []).includes(re.id))
  );
  const figliIds = new Set(diretti.map(a => a.id));
  const nipoti = viventi.filter(a =>
    !figliIds.has(a.id) && a.id !== re.id &&
    (a.genitoriIds ?? []).some(id => figliIds.has(id))
  );
  // Primogenitura: generazione diretta prima dei nipoti, poi eta' e ID.
  const ordine = (a: Abitante, b: Abitante) => b.eta - a.eta || a.id - b.id;
  return diretti.sort(ordine)[0] ?? nipoti.sort(ordine)[0];
}

function riassegnaIdentitaDinastica(a: Abitante, exReId: number, precedenteEredeId: number): Abitante {
  const aggiornaId = (id: number) => id === precedenteEredeId ? exReId : id;
  // I legami col Re defunto non possono diventare legami col nuovo Re.
  const aggiornaLista = (ids?: number[]) =>
    ids?.filter(id => id !== exReId).map(aggiornaId).filter(id => id !== a.id);
  return {
    ...a,
    coniugeId: a.coniugeId === exReId ? undefined : a.coniugeId == null ? undefined : aggiornaId(a.coniugeId),
    schiavistaId: a.schiavistaId === exReId ? undefined : a.schiavistaId == null ? undefined : aggiornaId(a.schiavistaId),
    genitoriIds: aggiornaLista(a.genitoriIds),
    genitoriAdottiviIds: aggiornaLista(a.genitoriAdottiviIds),
    nonniIds: aggiornaLista(a.nonniIds),
    figliIds: aggiornaLista(a.figliIds),
    figliAdottatiIds: aggiornaLista(a.figliAdottatiIds),
    amici: a.amici.filter(r => r.id !== exReId).map(r => ({ ...r, id: aggiornaId(r.id) })),
    rivali: a.rivali.filter(r => r.id !== exReId).map(r => ({ ...r, id: aggiornaId(r.id) }))
  };
}

export type EsitoCicloVita = {
  abitanti: Abitante[];
  edifici: Edificio[];
  mortiVecchiaia: { id: number; nome: string; eta: number }[];
  successione: SuccessioneDinastica | null;
};

/** Da applicare una sola volta al cambio d'anno, dopo l'aumento dell'eta'.
 * Nessun timer o chiamata di rete: il risultato entra nel salvataggio normale.
 */
export function applicaCicloVitaAnnuale(
  abitanti: Abitante[],
  edifici: Edificio[],
  anno: number,
  random: () => number = Math.random
): EsitoCicloVita {
  const cresciuti = abitanti.map(a => {
    const lavoro = lavoroDopoCrescita(a);
    return lavoro === a.lavoro ? a : { ...a, lavoro };
  });
  const morti = cresciuti.filter(a =>
    a.salute > 0 && random() < probabilitaMorteVecchiaia(a.eta, a.razza ?? "Umano", a.salute)
  );
  const mortiIds = new Set(morti.map(a => a.id));
  const vecchioRe = morti.find(a => a.id === 1);
  let viventi = cresciuti.filter(a => !mortiIds.has(a.id));
  let successione: SuccessioneDinastica | null = null;
  let nuovoReEredeId: number | null = null;

  if (vecchioRe) {
    const erede = scegliErede(vecchioRe, viventi);
    if (erede) {
      nuovoReEredeId = erede.id;
      successione = {
        predecessore: vecchioRe.nome,
        erede: erede.nome,
        eredeMinorenne: erede.eta < 18
      };
      viventi = viventi.filter(a => a.id !== erede.id).map(a =>
        riassegnaIdentitaDinastica(a, 1, erede.id)
      );
      const eredeConvertito = riassegnaIdentitaDinastica(
        { ...erede, id: 1, lavoro: "Re", ministero: undefined,
          storiaSovrani: [
            ...(vecchioRe.storiaSovrani ?? []),
            { nome: vecchioRe.nome, eta: vecchioRe.eta, anno, causa: "vecchiaia" as const }
          ] },
        1,
        erede.id
      );
      viventi.unshift(eredeConvertito);
    } else {
      // Senza eredi il game over esistente rimane applicabile.
      viventi.unshift({ ...vecchioRe, salute: 0 });
    }
  }

  const edificiPuliti = edifici.map(edificio => {
    const assegnati = (edificio.abitantiAssegnati ?? [])
      .filter(id => !mortiIds.has(id) && id !== nuovoReEredeId);
    return {
      ...edificio,
      abitantiAssegnati: assegnati,
      occupazione: assegnati.length
    };
  });

  return {
    abitanti: viventi,
    edifici: edificiPuliti,
    mortiVecchiaia: morti.map(a => ({ id: a.id, nome: a.nome, eta: a.eta })),
    successione
  };
}
