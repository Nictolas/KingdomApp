import type { Abitante } from "../types";
import { èRe, getGenitoriDecedutiRe, risolviParenteDecedutoRe } from "./reGenitoriDeceduti";

export type FamigliaVoce = {
  id: number;
  nome: string;
  adottato?: boolean;
  /** Genitore (o altro) non più in vita — es. genitori del Re. */
  deceduto?: boolean;
};

export type FamigliaSnapshot = {
  coniuge: FamigliaVoce | null;
  genitori: FamigliaVoce[];
  genitoriAdottivi: FamigliaVoce[];
  figli: FamigliaVoce[];
  figliAdottati: FamigliaVoce[];
  nonni: FamigliaVoce[];
};

function byId(abitanti: readonly Abitante[]): Map<number, Abitante> {
  const m = new Map<number, Abitante>();
  for (const a of abitanti) m.set(a.id, a);
  return m;
}

function voce(a: Abitante | undefined, id: number, adottato?: boolean): FamigliaVoce {
  return { id, nome: a?.nome ?? `#${id}`, adottato };
}

/** Figli adottati dichiarati sull’adulto (e presenti in `figliIds` se valorizzato). */
export function getFigliAdottatiIds(abitante: Abitante): number[] {
  const adottati = abitante.figliAdottatiIds ?? [];
  if (adottati.length === 0) return [];
  const figli = new Set(abitante.figliIds ?? []);
  if (figli.size === 0) return [...new Set(adottati)];
  return [...new Set(adottati.filter((id) => figli.has(id)))];
}

/** Genitori adottivi dell’abitante. */
export function getGenitoriAdottiviIds(abitante: Abitante): number[] {
  return [...new Set(abitante.genitoriAdottiviIds ?? [])];
}

/** Figli biologici = figliIds senza adottati. */
export function getFigliBiologiciIds(abitante: Abitante): number[] {
  const adottati = new Set(getFigliAdottatiIds(abitante));
  return (abitante.figliIds ?? []).filter((id) => !adottati.has(id));
}

/** Genitori “di sangue” mostrati: genitoriIds meno adottivi (se entrambi presenti). */
export function getGenitoriBiologiciIds(abitante: Abitante): number[] {
  const adottivi = new Set(getGenitoriAdottiviIds(abitante));
  const genitori = abitante.genitoriIds ?? [];
  if (adottivi.size === 0) return [...genitori];
  const soloBio = genitori.filter((id) => !adottivi.has(id));
  // Se tutti i genitoriIds sono anche adottivi, non duplicare in “biologici”.
  return soloBio;
}

export function snapshotFamiglia(abitante: Abitante, abitanti: readonly Abitante[]): FamigliaSnapshot {
  const map = byId(abitanti);
  const coniuge =
    abitante.coniugeId != null ? voce(map.get(abitante.coniugeId), abitante.coniugeId) : null;

  const genitoriAdottiviIds = getGenitoriAdottiviIds(abitante);
  const genitoriBioIds = getGenitoriBiologiciIds(abitante);
  // Se non ci sono adottivi espliciti, mostra tutti i genitoriIds come genitori.
  const genitoriIds =
    genitoriAdottiviIds.length > 0 ? genitoriBioIds : [...(abitante.genitoriIds ?? [])];

  let genitori = genitoriIds.map((id) => voce(map.get(id), id));
  // Re: se non ha genitori in vita registrati, mostra i due genitori deceduti (sintetici).
  if (èRe(abitante) && genitori.length === 0) {
    genitori = getGenitoriDecedutiRe(abitante).map((g) => ({
      id: g.id,
      nome: g.nome,
      deceduto: true as const
    }));
  } else {
    // Cugino nobile / altri: risolve genitori sintetici deceduti (zio/zia del Re).
    const re = [...map.values()].find((a) => èRe(a));
    if (re) {
      genitori = genitoriIds.map((id) => {
        const vivo = map.get(id);
        if (vivo) return voce(vivo, id);
        const dec = risolviParenteDecedutoRe(id, re);
        if (dec) return { id: dec.id, nome: dec.nome, deceduto: true as const };
        return voce(undefined, id);
      });
    }
  }

  return {
    coniuge,
    genitori,
    genitoriAdottivi: genitoriAdottiviIds.map((id) => voce(map.get(id), id, true)),
    figli: getFigliBiologiciIds(abitante).map((id) => voce(map.get(id), id)),
    figliAdottati: getFigliAdottatiIds(abitante).map((id) => voce(map.get(id), id, true)),
    nonni: [...new Set(abitante.nonniIds ?? [])].map((id) => voce(map.get(id), id))
  };
}

export type NodoAlberoFamiglia = {
  id: number;
  nome: string;
  eta: number;
  sesso?: "M" | "F";
  adottato: boolean;
  figli: NodoAlberoFamiglia[];
};

/**
 * Albero discendente a partire da `rootId` (figli biologici + adottati).
 * Evita cicli; `maxDepth` limita la profondità (default 6).
 */
export function buildAlberoDiscendente(
  rootId: number,
  abitanti: readonly Abitante[],
  maxDepth = 6
): NodoAlberoFamiglia | null {
  const map = byId(abitanti);
  const root = map.get(rootId);
  if (!root) return null;

  const visit = (id: number, depth: number, stack: Set<number>): NodoAlberoFamiglia | null => {
    const a = map.get(id);
    if (!a || stack.has(id)) return null;
    const adottato =
      getGenitoriAdottiviIds(a).length > 0 ||
      [...map.values()].some((p) => getFigliAdottatiIds(p).includes(id));
    const nextStack = new Set(stack);
    nextStack.add(id);
    const childIds = [...new Set([...(a.figliIds ?? []), ...getFigliAdottatiIds(a)])];
    const figli: NodoAlberoFamiglia[] =
      depth >= maxDepth
        ? []
        : childIds
            .map((cid) => visit(cid, depth + 1, nextStack))
            .filter((n): n is NodoAlberoFamiglia => n != null);
    return {
      id: a.id,
      nome: a.nome,
      eta: a.eta,
      sesso: a.sesso,
      adottato,
      figli
    };
  };

  return visit(rootId, 0, new Set());
}

/** Antenati (genitori + adottivi) fino a `maxDepth` livelli. */
export function buildCatenaAntenati(
  rootId: number,
  abitanti: readonly Abitante[],
  maxDepth = 4
): { id: number; nome: string; livello: number; adottivo: boolean }[] {
  const map = byId(abitanti);
  const out: { id: number; nome: string; livello: number; adottivo: boolean }[] = [];
  const seen = new Set<number>([rootId]);

  let frontier: { id: number; livello: number }[] = [{ id: rootId, livello: 0 }];
  while (frontier.length > 0) {
    const next: { id: number; livello: number }[] = [];
    for (const { id, livello } of frontier) {
      if (livello >= maxDepth) continue;
      const a = map.get(id);
      if (!a) continue;
      const adottivi = new Set(getGenitoriAdottiviIds(a));
      const genitori = [...new Set([...(a.genitoriIds ?? []), ...adottivi])];
      for (const gid of genitori) {
        if (seen.has(gid)) continue;
        seen.add(gid);
        const g = map.get(gid);
        out.push({
          id: gid,
          nome: g?.nome ?? `#${gid}`,
          livello: livello + 1,
          adottivo: adottivi.has(gid)
        });
        next.push({ id: gid, livello: livello + 1 });
      }
    }
    frontier = next;
  }
  return out.sort((a, b) => a.livello - b.livello || a.nome.localeCompare(b.nome, "it"));
}

/** True se ha almeno un genitore ancora presente tra gli abitanti vivi. */
export function haGenitoriVivi(abitante: Abitante, abitanti: readonly Abitante[]): boolean {
  const map = byId(abitanti);
  for (const id of [...(abitante.genitoriIds ?? []), ...getGenitoriAdottiviIds(abitante)]) {
    if (id < 0) continue; // id sintetici (es. genitori deceduti del Re)
    if (map.has(id)) return true;
  }
  return false;
}

/** Abitanti adottabili: umani/non-golem senza genitori vivi, non già figli dell’adottante. */
export function candidatiAdozione(
  adottanteId: number,
  abitanti: readonly Abitante[]
): Abitante[] {
  const adottante = abitanti.find((a) => a.id === adottanteId);
  const giaFigli = new Set([
    ...(adottante?.figliIds ?? []),
    ...(adottante?.figliAdottatiIds ?? [])
  ]);
  return abitanti
    .filter((a) => a.id !== adottanteId)
    .filter((a) => a.razza !== "Golem")
    .filter((a) => !giaFigli.has(a.id))
    .filter((a) => !haGenitoriVivi(a, abitanti))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

/** Applica adozione: figlio adottato + genitore adottivo. */
export function applicaAdozione(
  adottante: Abitante,
  figlio: Abitante
): { adottante: Abitante; figlio: Abitante } {
  return {
    adottante: {
      ...adottante,
      figliIds: [...new Set([...(adottante.figliIds ?? []), figlio.id])],
      figliAdottatiIds: [...new Set([...(adottante.figliAdottatiIds ?? []), figlio.id])]
    },
    figlio: {
      ...figlio,
      genitoriAdottiviIds: [...new Set([...(figlio.genitoriAdottiviIds ?? []), adottante.id])]
    }
  };
}

/** Radici potenziali per albero “regno”: senza genitori (né adottivi). */
export function trovaRadiciGenealogiche(abitanti: readonly Abitante[]): Abitante[] {
  return abitanti
    .filter((a) => a.razza !== "Golem")
    .filter((a) => (a.genitoriIds?.length ?? 0) === 0 && (a.genitoriAdottiviIds?.length ?? 0) === 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

/** True se A e B condividono un antenato entro `maxGradi` (BFS sui genitori). */
export function condividonoAntenatoEntroGradi(
  idA: number,
  idB: number,
  abitanti: readonly Abitante[],
  maxGradi = 2
): boolean {
  if (idA === idB) return true;
  const map = byId(abitanti);

  const antenati = (start: number): Set<number> => {
    const found = new Set<number>();
    let frontier = [start];
    for (let g = 0; g < maxGradi; g++) {
      const next: number[] = [];
      for (const id of frontier) {
        const a = map.get(id);
        if (!a) continue;
        for (const gid of [...(a.genitoriIds ?? []), ...getGenitoriAdottiviIds(a)]) {
          if (found.has(gid)) continue;
          found.add(gid);
          next.push(gid);
        }
      }
      frontier = next;
      if (frontier.length === 0) break;
    }
    return found;
  };

  const setA = antenati(idA);
  if (setA.has(idB)) return true;
  const setB = antenati(idB);
  if (setB.has(idA)) return true;
  for (const x of setA) {
    if (setB.has(x)) return true;
  }
  return false;
}
