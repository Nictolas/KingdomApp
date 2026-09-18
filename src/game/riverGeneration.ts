/**
 * Generazione procedurale di fiumi sulla griglia con Random Walk
 * e direzione preferenziale. Supporta biforcazioni e biomi (sabbia adiacente).
 */

import { cellaTerraSopraMare, getActiveCostaSud, isMareAttivo, MARE_PROFONDITA_MIN } from "./mareCosta";

export type TerrenoType = "erba" | "river" | "sabbia";

const DIR_SU = 0;
const DIR_DESTRA = 1;
const DIR_GIU = 2;
const DIR_SINISTRA = 3;

const DELTA: [number, number][] = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1]
];

export type RiverOptions = {
  cols: number;
  rows: number;
  /** Numero di sorgenti (fiumi) da generare */
  numSources: number;
  /** Lunghezza massima in celle per ogni ramo */
  maxLength: number;
  /** Probabilità (0–1) di biforcazione a ogni passo */
  bifurcationProbability: number;
  /** Indici di celle non percorribili (mare, edifici importanti, ecc.) */
  forbiddenIndices?: Set<number>;
  /** Seed opzionale per riproducibilità */
  seed?: number;
};

function indexToRowCol(index: number, cols: number): [number, number] {
  return [Math.floor(index / cols), index % cols];
}

function rowColToIndex(row: number, col: number, cols: number): number {
  return row * cols + col;
}

function isOnBorder(row: number, col: number, rows: number, cols: number): boolean {
  return isMareAttivo(row * cols + col, cols, rows);
}

/** Direzione preferenziale per fluire dall'edge dato verso l'interno */
function flowDirectionFromEdge(edge: number): number {
  return (edge + 2) % 4;
}

/** Sceglie un indice di partenza sulla prima fila di terra sopra la costa sud. */
function pickStartOnEdge(
  _edge: number,
  rows: number,
  cols: number,
  forbidden: Set<number>,
  random: () => number
): number | null {
  const depths = getActiveCostaSud();
  for (let attempt = 0; attempt < Math.max(8, cols); attempt++) {
    const col = Math.floor(random() * cols);
    const idx =
      depths && depths.length === cols
        ? cellaTerraSopraMare(col, cols, rows, depths)
        : (() => {
            const row = rows - MARE_PROFONDITA_MIN - 1;
            return row >= 0 ? row * cols + col : null;
          })();
    if (idx == null || forbidden.has(idx)) continue;
    return idx;
  }
  return null;
}

/** Vicini ortogonali con peso (stessa dir preferita, flow preferito). */
function getNeighbors(
  index: number,
  dir: number,
  rows: number,
  cols: number,
  blocked: Set<number>
): Array<{ index: number; dir: number; weight: number }> {
  const [r, c] = indexToRowCol(index, cols);
  const flowDir = DIR_SU; // fiumi dalla costa sud: preferenza verso l’interno (nord)
  const out: Array<{ index: number; dir: number; weight: number }> = [];
  for (let d = 0; d < 4; d++) {
    const [dr, dc] = DELTA[d];
    const r2 = r + dr;
    const c2 = c + dc;
    if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
    const idx2 = rowColToIndex(r2, c2, cols);
    if (blocked.has(idx2)) continue;
    let w = d === dir ? 0.55 : 0.225;
    if (d === flowDir) w += 0.15;
    out.push({ index: idx2, dir: d, weight: w });
  }
  return out;
}

function weightedPick<T>(items: Array<{ value: T; weight: number }>, random: () => number): T {
  const total = items.reduce((s, x) => s + x.weight, 0);
  let r = random() * total;
  for (const { value, weight } of items) {
    r -= weight;
    if (r <= 0) return value;
  }
  return items[items.length - 1].value;
}

export type SingleRiverOptions = {
  cols: number;
  rows: number;
  /** Altezza della fascia Bosco a nord: il fiume resta dritto su `gapCol`. */
  boscoH: number;
  /** Celle da evitare sotto il Bosco (edifici, mare). */
  forbiddenIndices?: Set<number>;
  /** Margine minimo a sinistra/destra per i due pezzi di Bosco. */
  marginCols?: number;
  seed?: number;
  random?: () => number;
};

/**
 * Un solo fiume: entra da nord (fuori mappa), colonna a caso tra i due Bosco,
 * meandro leggero verso sud fino al mare. Larghezza 1, niente sabbia.
 */
export function generateSingleRiverNordToMare(options: SingleRiverOptions): {
  riverIndices: number[];
  gapCol: number;
  sandIndices: number[];
} {
  const {
    cols,
    rows,
    boscoH,
    forbiddenIndices = new Set(),
    marginCols = 2,
    seed,
    random: randomOpt
  } = options;
  const random = randomOpt ?? (seed !== undefined ? seededRandom(seed) : Math.random);
  const margin = Math.max(2, Math.min(marginCols, Math.floor(cols / 2) - 1));
  const lo = margin;
  const hi = cols - 1 - margin;
  const gapCol = lo >= hi ? Math.floor(cols / 2) : lo + Math.floor(random() * (hi - lo + 1));

  const riverSet = new Set<number>();
  const hBosco = Math.max(1, Math.min(boscoH, rows));

  for (let r = 0; r < hBosco; r++) {
    riverSet.add(rowColToIndex(r, gapCol, cols));
  }

  let row = hBosco;
  let col = gapCol;
  let dir = DIR_GIU;
  let steps = 0;
  const maxSteps = cols * rows;

  while (row < rows && steps++ < maxSteps) {
    const idx = rowColToIndex(row, col, cols);
    if (isMareAttivo(idx, cols, rows)) break;
    if (!forbiddenIndices.has(idx) || isMareAttivo(idx, cols, rows)) {
      riverSet.add(idx);
    }

    const candidates: Array<{ row: number; col: number; dir: number; weight: number }> = [];
    for (let d = 0; d < 4; d++) {
      const [dr, dc] = DELTA[d]!;
      const r2 = row + dr;
      const c2 = col + dc;
      if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
      // Sotto il Bosco non rientrare nelle righe bosco.
      if (r2 < hBosco) continue;
      const i2 = rowColToIndex(r2, c2, cols);
      if (isMareAttivo(i2, cols, rows)) {
        candidates.push({ row: r2, col: c2, dir: d, weight: d === DIR_GIU ? 1 : 0.2 });
        continue;
      }
      if (riverSet.has(i2)) continue;
      // Mai attraversare edifici / celle vietate.
      if (forbiddenIndices.has(i2)) continue;
      let w = d === DIR_GIU ? 0.62 : d === dir ? 0.22 : 0.08;
      if (d === DIR_SU) w *= 0.15;
      if (w > 0) candidates.push({ row: r2, col: c2, dir: d, weight: w });
    }

    if (candidates.length === 0) {
      // Cerca un bypass ortogonale (sinistra/destra) non vietato, poi sud.
      let moved = false;
      for (const dc of random() < 0.5 ? [-1, 1] : [1, -1]) {
        const c2 = col + dc;
        if (c2 < 0 || c2 >= cols) continue;
        const i2 = rowColToIndex(row, c2, cols);
        if (forbiddenIndices.has(i2) && !isMareAttivo(i2, cols, rows)) continue;
        if (riverSet.has(i2)) continue;
        col = c2;
        moved = true;
        break;
      }
      if (!moved && row + 1 < rows) {
        const iSud = rowColToIndex(row + 1, col, cols);
        if (!forbiddenIndices.has(iSud) || isMareAttivo(iSud, cols, rows)) {
          row += 1;
          continue;
        }
        // Sud bloccato: prova diagonali sud.
        for (const dc of [-1, 1]) {
          const c2 = col + dc;
          if (c2 < 0 || c2 >= cols) continue;
          const i2 = rowColToIndex(row + 1, c2, cols);
          if (forbiddenIndices.has(i2) && !isMareAttivo(i2, cols, rows)) continue;
          row += 1;
          col = c2;
          moved = true;
          break;
        }
      }
      if (!moved) break;
      continue;
    }

    const chosen = weightedPick(
      candidates.map((c) => ({ value: c, weight: c.weight })),
      random
    );
    row = chosen.row;
    col = chosen.col;
    dir = chosen.dir;
  }

  return { riverIndices: Array.from(riverSet), gapCol, sandIndices: [] };
}

/**
 * Genera fiumi sulla griglia e restituisce gli insiemi di indici
 * per 'river' e per 'sabbia' (celle adiacenti al fiume, esclusa montagna).
 * @deprecated Preferisci `generateSingleRiverNordToMare`.
 */
export function generateRivers(options: RiverOptions): {
  riverIndices: number[];
  sandIndices: number[];
} {
  const {
    cols,
    rows,
    numSources,
    maxLength,
    bifurcationProbability,
    forbiddenIndices = new Set(),
    seed
  } = options;
  const random = seed !== undefined ? seededRandom(seed) : Math.random;
  const riverSet = new Set<number>();
  const branches: Array<{ index: number; dir: number }> = [];

  for (let s = 0; s < numSources; s++) {
    const edge = 2; // solo costa sud
    const blocked = new Set(forbiddenIndices);
    const start = pickStartOnEdge(edge, rows, cols, blocked, random);
    if (start == null) continue;
    const flowDir = flowDirectionFromEdge(edge);
    branches.push({ index: start, dir: flowDir });
  }

  const blocked = () => new Set([...forbiddenIndices, ...riverSet]);

  let maxIter = numSources * maxLength * 4;
  while (branches.length > 0 && maxIter-- > 0) {
    const b = branches.shift()!;
    let index = b.index;
    let dir = b.dir;
    let length = 0;

    while (length < maxLength) {
      riverSet.add(index);
      const [row, col] = indexToRowCol(index, cols);
      if (isOnBorder(row, col, rows, cols)) break;

      const neighbors = getNeighbors(index, dir, rows, cols, blocked());
      if (neighbors.length === 0) break;

      const chosen = weightedPick(
        neighbors.map((n) => ({ value: n, weight: n.weight })),
        random
      );

      if (random() < bifurcationProbability && length > 2 && neighbors.length >= 2) {
        const other = neighbors.find((n) => n.index !== chosen.index);
        if (other) branches.push({ index: other.index, dir: other.dir });
      }

      index = chosen.index;
      dir = chosen.dir;
      length++;
    }
  }

  const riverIndices = Array.from(riverSet);

  const sandIndices: number[] = [];
  const sandSet = new Set<number>();
  for (const idx of riverSet) {
    const [r, c] = indexToRowCol(idx, cols);
    for (const [dr, dc] of DELTA) {
      const r2 = r + dr;
      const c2 = c + dc;
      if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
      const i2 = rowColToIndex(r2, c2, cols);
      if (riverSet.has(i2) || forbiddenIndices.has(i2)) continue;
      if (!sandSet.has(i2)) {
        sandSet.add(i2);
        sandIndices.push(i2);
      }
    }
  }

  const sandIndicesPruned = pruneSandMinTwoSandNeighbors(sandIndices, cols, rows);

  return { riverIndices, sandIndices: sandIndicesPruned };
}

/** Vicini ortogonali che sono ancora sabbia (solo insieme `sandSet`). */
function countSandNeighborsOrth(index: number, sandSet: Set<number>, cols: number, rows: number): number {
  const [r, c] = indexToRowCol(index, cols);
  let n = 0;
  for (const [dr, dc] of DELTA) {
    const r2 = r + dr;
    const c2 = c + dc;
    if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
    const i2 = rowColToIndex(r2, c2, cols);
    if (sandSet.has(i2)) n++;
  }
  return n;
}

/**
 * Ogni cella sabbia deve avere almeno 2 vicini ortogonali sabbia (nessun tile “isolato”
 * senza abbastanza continuità per l’autotile). Rimuove iterativamente le sabbie sotto soglia.
 */
function pruneSandMinTwoSandNeighbors(sandIndices: number[], cols: number, rows: number): number[] {
  const sandSet = new Set(sandIndices);
  let changed = true;
  while (changed) {
    changed = false;
    const toRemove: number[] = [];
    for (const i of sandSet) {
      if (countSandNeighborsOrth(i, sandSet, cols, rows) < 2) toRemove.push(i);
    }
    for (const i of toRemove) {
      sandSet.delete(i);
      changed = true;
    }
  }
  return Array.from(sandSet);
}

/** Terra erba (non mare, tipo esplicito o implicito `erba`). */
function isCellaErbaTerreno(
  index: number,
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number
): boolean {
  if (isMareCell(index, cols, rows)) return false;
  return (terreno[index] ?? "erba") === "erba";
}

/** Vicini ortogonali che sono ancora erba (stessa logica di `isCellaErbaTerreno`). */
function countGrassNeighborsOrth(
  index: number,
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number
): number {
  const [r, c] = indexToRowCol(index, cols);
  let n = 0;
  for (const [dr, dc] of DELTA) {
    const r2 = r + dr;
    const c2 = c + dc;
    if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
    const i2 = rowColToIndex(r2, c2, cols);
    if (isCellaErbaTerreno(i2, terreno, cols, rows)) n++;
  }
  return n;
}

/**
 * Ogni cella erba deve avere almeno 2 vicini ortogonali erba (come la sabbia).
 * Le celle sotto soglia diventano sabbia (poi gestite dal pruning sabbia / fascia acqua).
 */
function pruneGrassMinTwoGrassNeighbors(
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number,
  exclude?: Set<number>
): boolean {
  const ex = exclude ?? new Set();
  let any = false;
  let changed = true;
  while (changed) {
    changed = false;
    const toSand: number[] = [];
    const tot = cols * rows;
    for (let i = 0; i < tot; i++) {
      if (isMareCell(i, cols, rows)) continue;
      if (ex.has(i)) continue;
      if (!isCellaErbaTerreno(i, terreno, cols, rows)) continue;
      if (countGrassNeighborsOrth(i, terreno, cols, rows) < 2) toSand.push(i);
    }
    for (const i of toSand) {
      terreno[i] = "sabbia";
      any = true;
      changed = true;
    }
  }
  return any;
}

/** Rimuove sabbia con meno di 2 vicini sabbia; le celle tornano erba (chiave rimossa). */
function pruneSandMinTwoSandNeighborsInTerreno(
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number
): boolean {
  const allSand: number[] = [];
  const tot = cols * rows;
  for (let i = 0; i < tot; i++) {
    if ((terreno[i] ?? "erba") === "sabbia") allSand.push(i);
  }
  const pruned = pruneSandMinTwoSandNeighbors(allSand, cols, rows);
  const keep = new Set(pruned);
  let any = false;
  for (const i of allSand) {
    if (!keep.has(i)) {
      delete terreno[i];
      any = true;
    }
  }
  return any;
}

/**
 * Allinea erba e sabbia alle regole di continuità (≥2 vicini ortogonali dello stesso tipo)
 * e ripete fascia sabbia sull’acqua finché non c’è più cambiamento.
 */
export function applyTerrenoGrassAndSandContinuity(
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number,
  excludeFromSand?: Set<number>
): void {
  for (let k = 0; k < 64; k++) {
    const g = pruneGrassMinTwoGrassNeighbors(terreno, cols, rows, excludeFromSand);
    const s = pruneSandMinTwoSandNeighborsInTerreno(terreno, cols, rows);
    const w = applySandAdjacentToAnyWater(terreno, cols, rows, excludeFromSand);
    const iso = pruneSandOrthogonallySurroundedByWaterOnly(terreno, cols, rows);
    if (!g && !s && !w && !iso) break;
  }
  fillErbaEnclosedByWater(terreno, cols, rows);
}

/** Restituisce un Record indice → tipo terreno (solo per celle non erba). */
export function buildTerrenoFromRivers(
  riverIndices: number[],
  sandIndices: number[],
  /** Indici da non marcare come sabbia (es. montagna/Miniera) */
  excludeFromSand?: Set<number>
): Record<number, TerrenoType> {
  const out: Record<number, TerrenoType> = {};
  const exclude = excludeFromSand ?? new Set();
  for (const i of riverIndices) out[i] = "river";
  for (const i of sandIndices) {
    if (!exclude.has(i)) out[i] = "sabbia";
  }
  return out;
}

/** Mare = costa sud frastagliata (niente bordi laterali/nord). */
export function isMareCell(index: number, cols: number, rows: number): boolean {
  return isMareAttivo(index, cols, rows);
}

/** Cella mare (bordo) o fiume. */
export function isTerrenoAcqua(
  index: number,
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number
): boolean {
  if (isMareCell(index, cols, rows)) return true;
  return (terreno[index] ?? "erba") === "river";
}

/** Tutti e quattro i vicini ortogonali sono mare o fiume. */
export function isOrthogonallySurroundedByWater(
  index: number,
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number
): boolean {
  const [r, c] = indexToRowCol(index, cols);
  for (const [dr, dc] of DELTA) {
    const r2 = r + dr;
    const c2 = c + dc;
    if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) return false;
    const j = rowColToIndex(r2, c2, cols);
    if (!isTerrenoAcqua(j, terreno, cols, rows)) return false;
  }
  return true;
}

/**
 * Celle erba “intrappolate” tra acqua → fiume (evita tile rossi al centro di laghi/fiumi).
 */
export function fillErbaEnclosedByWater(
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number
): void {
  let changed = true;
  while (changed) {
    changed = false;
    const tot = cols * rows;
    for (let i = 0; i < tot; i++) {
      if (isMareCell(i, cols, rows)) continue;
      if ((terreno[i] ?? "erba") !== "erba") continue;
      if (!isOrthogonallySurroundedByWater(i, terreno, cols, rows)) continue;
      terreno[i] = "river";
      changed = true;
    }
  }
}

/** Vicino ortogonale è solo acqua (mare o fiume). */
export function isAcquaOrtogonale(
  index: number,
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number
): boolean {
  if (isMareCell(index, cols, rows)) return true;
  return (terreno[index] ?? "erba") === "river";
}

/** Almeno un vicino ortogonale è mare o fiume. */
export function hasOrthogonalWaterNeighbor(
  index: number,
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number
): boolean {
  const [r, c] = indexToRowCol(index, cols);
  for (const [dr, dc] of DELTA) {
    const r2 = r + dr;
    const c2 = c + dc;
    if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
    const j = rowColToIndex(r2, c2, cols);
    if (isAcquaOrtogonale(j, terreno, cols, rows)) return true;
  }
  return false;
}

/** Almeno un vicino ortogonale è sabbia/spiaggia. */
export function hasOrthogonalSandNeighbor(
  index: number,
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number
): boolean {
  const [r, c] = indexToRowCol(index, cols);
  for (const [dr, dc] of DELTA) {
    const r2 = r + dr;
    const c2 = c + dc;
    if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
    const j = rowColToIndex(r2, c2, cols);
    if ((terreno[j] ?? "erba") === "sabbia") return true;
  }
  return false;
}

/** Rimuove celle strada adiacenti alla sabbia (niente contatto diretto strada ↔ spiaggia). */
export function removeStradeAdjacentToSand(
  edifici: Record<number, { nome?: string }>,
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number
): void {
  for (const ks of Object.keys(edifici)) {
    const i = Number(ks);
    if (edifici[i]?.nome !== "Strada") continue;
    if (hasOrthogonalSandNeighbor(i, terreno, cols, rows)) {
      delete edifici[i];
    }
  }
}

/**
 * Nessuna strada né erba piana (`erba_centro`) adiacente all’acqua: rimuove strade invalide e
 * converte l’erba confinante in sabbia (fascia costiera).
 */
export function ensureNoDirectWaterAdjacencyForStradaAndErba(
  edifici: Record<number, { nome?: string }>,
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number,
  neverSand: Set<number> = new Set()
): void {
  for (const ks of Object.keys(edifici)) {
    const i = Number(ks);
    if (edifici[i]?.nome !== "Strada") continue;
    if (hasOrthogonalWaterNeighbor(i, terreno, cols, rows)) {
      delete edifici[i];
    }
  }

  const tot = cols * rows;
  for (let i = 0; i < tot; i++) {
    if (neverSand.has(i)) continue;
    if (edifici[i]) continue;
    if (isMareCell(i, cols, rows)) continue;
    if ((terreno[i] ?? "erba") === "river") continue;
    if ((terreno[i] ?? "erba") !== "erba") continue;
    // Sabbia costiera: mare e fiume (come le spiagge del mare).
    if (hasOrthogonalWaterNeighbor(i, terreno, cols, rows)) {
      terreno[i] = "sabbia";
    }
  }
}

/**
 * Regole di confine per strade ed erba: niente contatto con acqua né sabbia; ricollega la rete.
 */
export function ensureStradaErbaTerrainBoundaryRules(
  edifici: Record<number, { nome?: string }>,
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number,
  neverSand: Set<number>,
  reconnectStrada: (
    edifici: Record<number, { nome?: string }>,
    terreno: Record<number, TerrenoType>,
    cols: number,
    rows: number
  ) => void
): void {
  ensureNoDirectWaterAdjacencyForStradaAndErba(edifici, terreno, cols, rows, neverSand);
  removeStradeAdjacentToSand(edifici, terreno, cols, rows);
  reconnectStrada(edifici, terreno, cols, rows);
  ensureNoDirectWaterAdjacencyForStradaAndErba(edifici, terreno, cols, rows, neverSand);
  removeStradeAdjacentToSand(edifici, terreno, cols, rows);
}

/**
 * Almeno un vicino ortogonale erba o sabbia: evita fascia sabbia su “buchi” circondati solo da acqua
 * e rompe l’oscillazione prune → riapplica sabbia.
 */
function hasOrthogonalErbaOrSabbia(
  index: number,
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number
): boolean {
  const [r, c] = indexToRowCol(index, cols);
  for (const [dr, dc] of DELTA) {
    const r2 = r + dr;
    const c2 = c + dc;
    if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
    const j = rowColToIndex(r2, c2, cols);
    const t = terreno[j] ?? "erba";
    if (t === "erba" || t === "sabbia") return true;
  }
  return false;
}

/**
 * Rimuove sabbia i cui quattro vicini ortogonali sono tutti acqua (chiazze isolate in mezzo al mare/fiume).
 */
function pruneSandOrthogonallySurroundedByWaterOnly(
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number
): boolean {
  let any = false;
  let changed = true;
  while (changed) {
    changed = false;
    const tot = cols * rows;
    for (let i = 0; i < tot; i++) {
      if ((terreno[i] ?? "erba") !== "sabbia") continue;
      const [r, c] = indexToRowCol(i, cols);
      let tuttiAcqua = true;
      for (const [dr, dc] of DELTA) {
        const r2 = r + dr;
        const c2 = c + dc;
        if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) {
          tuttiAcqua = false;
          break;
        }
        const j = rowColToIndex(r2, c2, cols);
        if (!isAcquaOrtogonale(j, terreno, cols, rows)) {
          tuttiAcqua = false;
          break;
        }
      }
      if (tuttiAcqua) {
        terreno[i] = "river";
        any = true;
        changed = true;
      }
    }
  }
  return any;
}

/**
 * Fascia di sabbia lungo mare e fiume (stesso trattamento della costa).
 */
export function applySandAdjacentToAnyWater(
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number,
  excludeFromSand?: Set<number>
): boolean {
  const ex = excludeFromSand ?? new Set();
  const tot = cols * rows;
  let changed = false;
  for (let i = 0; i < tot; i++) {
    if (isMareCell(i, cols, rows)) continue;
    if ((terreno[i] ?? "erba") === "river") continue;
    if (ex.has(i)) continue;
    const [r, c] = indexToRowCol(i, cols);
    let vicinoAcqua = false;
    for (const [dr, dc] of DELTA) {
      const r2 = r + dr;
      const c2 = c + dc;
      if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
      const j = rowColToIndex(r2, c2, cols);
      if (isMareCell(j, cols, rows) || (terreno[j] ?? "erba") === "river") {
        vicinoAcqua = true;
        break;
      }
    }
    if (
      vicinoAcqua &&
      hasOrthogonalErbaOrSabbia(i, terreno, cols, rows) &&
      (terreno[i] ?? "erba") !== "sabbia"
    ) {
      terreno[i] = "sabbia";
      changed = true;
    }
  }
  return changed;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
