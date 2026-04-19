/** Pathfinding sulla griglia mappa (solo celle percorribili). */

export function orthogonalNeighbors(index: number, cols: number, rows: number): number[] {
  const c = index % cols;
  const r = Math.floor(index / cols);
  const out: number[] = [];
  if (c > 0) out.push(index - 1);
  if (c < cols - 1) out.push(index + 1);
  if (r > 0) out.push(index - cols);
  if (r < rows - 1) out.push(index + cols);
  return out;
}

/** Celle ortogonali walkable attorno all’anchor (ingressi “porta”). */
export function celleIngressoWalkableAttornoAdAnchor(
  anchor: number,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number[] {
  return orthogonalNeighbors(anchor, cols, rows).filter(isWalkable);
}

/**
 * BFS: da `start` (deve essere walkable) fino a una qualsiasi cella in `goalCells`.
 * Restituisce il percorso inclusivo [start, ..., last] dove last ∈ goalCells.
 */
export function trovaPercorsoVersoCelle(
  start: number,
  goalCells: Set<number>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean,
  maxIter = 80000
): number[] | null {
  if (goalCells.has(start)) return [start];
  const visited = new Set<number>([start]);
  const parent = new Map<number, number>();
  const q: number[] = [start];
  let iter = 0;
  let found: number | null = null;

  while (q.length > 0 && iter < maxIter) {
    iter++;
    const cur = q.shift()!;
    for (const nb of orthogonalNeighbors(cur, cols, rows)) {
      if (!isWalkable(nb) || visited.has(nb)) continue;
      visited.add(nb);
      parent.set(nb, cur);
      if (goalCells.has(nb)) {
        found = nb;
        q.length = 0;
        break;
      }
      q.push(nb);
    }
  }

  if (found == null) return null;
  const out: number[] = [];
  let b: number | undefined = found;
  while (b !== undefined) {
    out.push(b);
    b = parent.get(b);
  }
  out.reverse();
  return out.length >= 1 ? out : null;
}

/** Se `start` non è walkable, prova i vicini ortogonali walkable più vicini al goal (euristica semplice). */
export function scegliCellaPartenzaWalkable(
  preferita: number,
  goalAnchor: number,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number | null {
  if (isWalkable(preferita)) return preferita;
  const cands = orthogonalNeighbors(preferita, cols, rows).filter(isWalkable);
  if (cands.length === 0) return null;
  const gr = Math.floor(goalAnchor / cols);
  const gc = goalAnchor % cols;
  cands.sort((a, b) => {
    const ar = Math.floor(a / cols);
    const ac = a % cols;
    const br = Math.floor(b / cols);
    const bc = b % cols;
    const da = Math.abs(ar - gr) + Math.abs(ac - gc);
    const db = Math.abs(br - gr) + Math.abs(bc - gc);
    return da - db;
  });
  return cands[0] ?? null;
}

/**
 * Prima cella percorribile raggiungibile da `seed` con BFS (anche attraverso celle non walkable:
 * serve per “uscire” da anchor su edificio / footprint).
 */
export function trovaCellaWalkablePiuVicina(
  seed: number,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean,
  maxIter = 20000
): number | null {
  if (isWalkable(seed)) return seed;
  const visited = new Set<number>([seed]);
  const q: number[] = [seed];
  let iter = 0;
  while (q.length > 0 && iter < maxIter) {
    iter++;
    const cur = q.shift()!;
    for (const nb of orthogonalNeighbors(cur, cols, rows)) {
      if (visited.has(nb)) continue;
      visited.add(nb);
      if (isWalkable(nb)) return nb;
      q.push(nb);
    }
  }
  return null;
}
