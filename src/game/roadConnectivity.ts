import type { TerrenoType } from "./riverGeneration";

const DELTA: [number, number][] = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1]
];

/** Edificio sulla mappa (solo campi usati qui). */
export type EdificioMappa = {
  nome?: string;
  footprint?: { w: number; h: number };
  footprintRef?: number;
  id?: number;
  emoji?: string;
};

function isMareCell(index: number, cols: number, rows: number): boolean {
  const row = Math.floor(index / cols);
  const col = index % cols;
  return row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
}

/** Solo erba (implicita o esplicita): niente sabbia né fiume. */
function isTerrenoErba(
  index: number,
  terreno: Record<number, TerrenoType>
): boolean {
  return (terreno[index] ?? "erba") === "erba";
}

/**
 * Cammino per pavimentare strade: solo erba o celle già strada, non attraverso edifici non-strada.
 * La sabbia non è attraversabile: le strade restano agganciate solo all’erba.
 */
function passabilePerAttraversamento(
  index: number,
  cols: number,
  rows: number,
  terreno: Record<number, TerrenoType>,
  edifici: Record<number, EdificioMappa>
): boolean {
  if (isMareCell(index, cols, rows)) return false;
  if (!isTerrenoErba(index, terreno)) return false;
  const e = edifici[index];
  if (e && e.nome !== "Strada") return false;
  return true;
}

/** Cella vuota dove si può piazzare una nuova strada. */
function puoRicevereStrada(
  index: number,
  cols: number,
  rows: number,
  terreno: Record<number, TerrenoType>,
  edifici: Record<number, EdificioMappa>
): boolean {
  if (!passabilePerAttraversamento(index, cols, rows, terreno, edifici)) return false;
  return !edifici[index];
}

function getIndiciFootprint(anchor: number, w: number, h: number, cols: number): number[] {
  const ac = anchor % cols;
  const ar = Math.floor(anchor / cols);
  const out: number[] = [];
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      out.push((ar + dr) * cols + (ac + dc));
    }
  }
  return out;
}

function celleFootprintEdificio(anchor: number, edifici: Record<number, EdificioMappa>, cols: number): number[] {
  const e = edifici[anchor];
  if (!e?.footprint) return [anchor];
  return getIndiciFootprint(anchor, e.footprint.w, e.footprint.h, cols);
}

/** Ancore uniche (un edificio multi-cella = un anchor). */
export function elencoAncoreEdificiNonStrada(edifici: Record<number, EdificioMappa>): number[] {
  const out: number[] = [];
  for (const ks of Object.keys(edifici)) {
    const i = Number(ks);
    const e = edifici[i];
    if (!e || e.nome === "Strada") continue;
    if (e.footprintRef != null) continue;
    out.push(i);
  }
  return out;
}

function edificioToccaStrada(
  anchor: number,
  edifici: Record<number, EdificioMappa>,
  cols: number,
  rows: number
): boolean {
  for (const fp of celleFootprintEdificio(anchor, edifici, cols)) {
    const r = Math.floor(fp / cols);
    const c = fp % cols;
    for (const [dr, dc] of DELTA) {
      const r2 = r + dr;
      const c2 = c + dc;
      if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
      const j = r2 * cols + c2;
      if (edifici[j]?.nome === "Strada") return true;
    }
  }
  return false;
}

/** Vicini ortogonali liberi dove poter mettere strada per “agganciare” l’edificio. */
function obiettiviAggancioStrada(
  anchor: number,
  edifici: Record<number, EdificioMappa>,
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number
): number[] {
  const goals: number[] = [];
  const seen = new Set<number>();
  for (const fp of celleFootprintEdificio(anchor, edifici, cols)) {
    const r = Math.floor(fp / cols);
    const c = fp % cols;
    for (const [dr, dc] of DELTA) {
      const r2 = r + dr;
      const c2 = c + dc;
      if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
      const j = r2 * cols + c2;
      if (seen.has(j)) continue;
      seen.add(j);
      if (puoRicevereStrada(j, cols, rows, terreno, edifici)) goals.push(j);
    }
  }
  return goals;
}

function raccogliIndiciStrada(edifici: Record<number, EdificioMappa>): number[] {
  return Object.keys(edifici)
    .map(Number)
    .filter((i) => edifici[i]?.nome === "Strada");
}

/** Vicini ortogonali di tutte le celle strada (per escludere sabbia procedurale accanto alle strade). */
export function indiciViciniOrtogonaliStrada(
  edifici: Record<number, EdificioMappa>,
  cols: number,
  rows: number
): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const ks of Object.keys(edifici)) {
    const i = Number(ks);
    if (edifici[i]?.nome !== "Strada") continue;
    const r = Math.floor(i / cols);
    const c = i % cols;
    for (const [dr, dc] of DELTA) {
      const r2 = r + dr;
      const c2 = c + dc;
      if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
      const j = r2 * cols + c2;
      if (seen.has(j)) continue;
      seen.add(j);
      out.push(j);
    }
  }
  return out;
}

/**
 * BFS da tutte le celle strada verso il primo obiettivo raggiungibile; pavimenta le celle vuote sul percorso.
 * Restituisce true se ha pavimentato almeno una cella o raggiunto obiettivo già strada.
 */
function pavimentaPercorsoDaReteStradaVersoObiettivi(
  obiettivi: Set<number>,
  edifici: Record<number, EdificioMappa>,
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number,
  stradaTemplate: EdificioMappa
): boolean {
  const stradaPartenza = raccogliIndiciStrada(edifici);
  if (stradaPartenza.length === 0) return false;

  for (const goal of obiettivi) {
    if (edifici[goal]?.nome === "Strada") return true;
  }

  const visited = new Set<number>();
  const parent = new Map<number, number>();
  const queue: number[] = [];

  for (const s of stradaPartenza) {
    visited.add(s);
    parent.set(s, s);
    queue.push(s);
  }

  let raggiunto: number | null = null;
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (obiettivi.has(cur)) {
      raggiunto = cur;
      break;
    }
    const r = Math.floor(cur / cols);
    const c = cur % cols;
    for (const [dr, dc] of DELTA) {
      const r2 = r + dr;
      const c2 = c + dc;
      if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
      const n = r2 * cols + c2;
      if (visited.has(n)) continue;
      if (!passabilePerAttraversamento(n, cols, rows, terreno, edifici)) continue;
      visited.add(n);
      parent.set(n, cur);
      queue.push(n);
    }
  }

  if (raggiunto == null) return false;

  let p = raggiunto;
  for (let guard = 0; guard < cols * rows; guard++) {
    if (edifici[p]?.nome === "Strada") break;
    if (puoRicevereStrada(p, cols, rows, terreno, edifici)) {
      edifici[p] = { ...stradaTemplate };
    }
    const pr = parent.get(p);
    if (pr === undefined || p === pr) break;
    p = pr;
  }
  return true;
}

/** BFS tra due celle passabili; pavimenta celle vuote sul percorso (estremi possono essere strada). */
function pavimentaPercorsoTra(
  da: number,
  a: number,
  edifici: Record<number, EdificioMappa>,
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number,
  stradaTemplate: EdificioMappa
): boolean {
  if (da === a) return true;
  const visited = new Set<number>([da]);
  const parent = new Map<number, number>();
  parent.set(da, da);
  const queue: number[] = [da];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === a) {
      let x = a;
      while (x !== da) {
        if (puoRicevereStrada(x, cols, rows, terreno, edifici)) {
          edifici[x] = { ...stradaTemplate };
        }
        const px = parent.get(x);
        if (px === undefined) return false;
        x = px;
      }
      return true;
    }
    const r = Math.floor(cur / cols);
    const c = cur % cols;
    for (const [dr, dc] of DELTA) {
      const r2 = r + dr;
      const c2 = c + dc;
      if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
      const n = r2 * cols + c2;
      if (visited.has(n)) continue;
      if (!passabilePerAttraversamento(n, cols, rows, terreno, edifici)) continue;
      visited.add(n);
      parent.set(n, cur);
      queue.push(n);
    }
  }
  return false;
}

function componentiStrada(edifici: Record<number, EdificioMappa>, cols: number, rows: number): number[][] {
  const strade = raccogliIndiciStrada(edifici);
  const stradaSet = new Set(strade);
  const visited = new Set<number>();
  const comps: number[][] = [];

  for (const s of strade) {
    if (visited.has(s)) continue;
    const comp: number[] = [];
    const q = [s];
    visited.add(s);
    while (q.length > 0) {
      const cur = q.pop()!;
      comp.push(cur);
      const r = Math.floor(cur / cols);
      const c = cur % cols;
      for (const [dr, dc] of DELTA) {
        const r2 = r + dr;
        const c2 = c + dc;
        if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
        const n = r2 * cols + c2;
        if (!stradaSet.has(n) || visited.has(n)) continue;
        visited.add(n);
        q.push(n);
      }
    }
    comps.push(comp);
  }
  return comps;
}

/**
 * Dopo aver piazzato strade a singolo tile, espande ogni tratto a corsia larga 2:
 * tratti E–O hanno anche la riga parallela (preferenza sud); tratti N–S anche la colonna (preferenza est).
 * Ripete fino a stabilità; una cella strada isolata riceve un vicino ortogonale (domino) se possibile.
 */
export function espandiStradeLarghezzaDue(
  edifici: Record<number, EdificioMappa>,
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number,
  stradaTemplate: EdificioMappa
): void {
  const tpl = { ...stradaTemplate };
  const isStrada = (i: number) => edifici[i]?.nome === "Strada";

  const tryPlace = (j: number): boolean => {
    if (!puoRicevereStrada(j, cols, rows, terreno, edifici)) return false;
    edifici[j] = { ...tpl };
    return true;
  };

  const oneThickenPass = (): boolean => {
    let changed = false;
    for (const i of raccogliIndiciStrada(edifici)) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const hasH =
        (c > 0 && isStrada(i - 1)) || (c < cols - 1 && isStrada(i + 1));
      const hasV =
        (r > 0 && isStrada(i - cols)) || (r < rows - 1 && isStrada(i + cols));

      if (hasH) {
        const hasBuddyH =
          (r + 1 < rows && isStrada(i + cols)) || (r > 0 && isStrada(i - cols));
        if (!hasBuddyH) {
          if (r + 1 < rows && tryPlace(i + cols)) changed = true;
          else if (r > 0 && tryPlace(i - cols)) changed = true;
        }
      }
      if (hasV) {
        const hasBuddyV =
          (c + 1 < cols && isStrada(i + 1)) || (c > 0 && isStrada(i - 1));
        if (!hasBuddyV) {
          if (c + 1 < cols && tryPlace(i + 1)) changed = true;
          else if (c > 0 && tryPlace(i - 1)) changed = true;
        }
      }
    }
    return changed;
  };

  const maxGuard = cols * rows * 4;
  let guard = 0;
  while (guard++ < maxGuard && oneThickenPass()) {}

  const isolati = raccogliIndiciStrada(edifici).filter((i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    for (const [dr, dc] of DELTA) {
      const r2 = r + dr;
      const c2 = c + dc;
      if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
      if (isStrada(r2 * cols + c2)) return false;
    }
    return true;
  });
  const tryOrder = (i: number): number[] => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const o: number[] = [];
    if (r + 1 < rows) o.push(i + cols);
    if (c + 1 < cols) o.push(i + 1);
    if (r > 0) o.push(i - cols);
    if (c > 0) o.push(i - 1);
    return o;
  };
  for (const i of isolati) {
    for (const j of tryOrder(i)) {
      if (tryPlace(j)) break;
    }
  }

  guard = 0;
  while (guard++ < maxGuard && oneThickenPass()) {}
}

/**
 * Regola: ogni edificio ha almeno un vicino ortogonale strada e tutte le celle strada formano un’unica
 * componente connessa (ortogonale). Aggiunge strada su celle vuote (mare/fiume/edifici intatti esclusi).
 */
export function assicuraEdificiCollegatiDaStrada(
  edifici: Record<number, EdificioMappa>,
  terreno: Record<number, TerrenoType>,
  cols: number,
  rows: number,
  stradaTemplate: EdificioMappa
): void {
  const anchors = elencoAncoreEdificiNonStrada(edifici);
  if (anchors.length === 0) return;

  const stradaCell = { ...stradaTemplate };

  if (raccogliIndiciStrada(edifici).length === 0) {
    for (const anchor of anchors) {
      const goals = obiettiviAggancioStrada(anchor, edifici, terreno, cols, rows);
      if (goals.length > 0) {
        edifici[goals[0]!] = { ...stradaCell };
        break;
      }
    }
  }

  for (let round = 0; round < 16; round++) {
    for (const anchor of anchors) {
      if (edificioToccaStrada(anchor, edifici, cols, rows)) continue;
      const goals = obiettiviAggancioStrada(anchor, edifici, terreno, cols, rows);
      if (goals.length === 0) continue;
      const goalSet = new Set(goals);
      if (!pavimentaPercorsoDaReteStradaVersoObiettivi(goalSet, edifici, terreno, cols, rows, stradaCell)) {
        const g0 = goals[0]!;
        if (puoRicevereStrada(g0, cols, rows, terreno, edifici)) {
          edifici[g0] = { ...stradaCell };
        }
      }
    }

    for (let m = 0; m < 64; m++) {
      const comps = componentiStrada(edifici, cols, rows);
      if (comps.length <= 1) break;
      const ok = pavimentaPercorsoTra(
        comps[0]![0]!,
        comps[1]![0]!,
        edifici,
        terreno,
        cols,
        rows,
        stradaCell
      );
      if (!ok) break;
    }
  }

  espandiStradeLarghezzaDue(edifici, terreno, cols, rows, stradaTemplate);
}
