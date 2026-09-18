import type { MappaRuntimeState } from "./mappaTypes";
import { NOME_BOSCO } from "./buildingGeometry";

/** Profondità minima del mare (celle dal bordo sud). */
export const MARE_PROFONDITA_MIN = 2;
/** Profondità tipica massima del random-walk costiero. */
export const MARE_PROFONDITA_MAX = 5;
/** Baie occasionali: una cella in più rispetto al max tipico. */
export const MARE_PROFONDITA_BAIA = 6;

/** Profondità mare per colonna (celle dal basso), attiva per isMare / generazione. */
let activeCostaSud: readonly number[] | null = null;

export function setActiveCostaSud(depths: readonly number[] | null): void {
  activeCostaSud = depths;
}

export function getActiveCostaSud(): readonly number[] | null {
  return activeCostaSud;
}

/**
 * Costa sud frastagliata: random-walk sulla profondità + baie/promontori.
 * L’ultima riga è sempre mare; sinistra/destra/nord non sono mare.
 */
export function generaProfonditaCostaSud(cols: number, random: () => number = Math.random): number[] {
  if (cols < 1) return [];
  const depths = new Array<number>(cols);
  depths[0] =
    MARE_PROFONDITA_MIN + Math.floor(random() * (MARE_PROFONDITA_MAX - MARE_PROFONDITA_MIN + 1));
  for (let c = 1; c < cols; c++) {
    const step = Math.floor(random() * 3) - 1;
    depths[c] = Math.max(
      MARE_PROFONDITA_MIN,
      Math.min(MARE_PROFONDITA_MAX, (depths[c - 1] ?? MARE_PROFONDITA_MIN) + step)
    );
  }

  const bays = Math.max(2, Math.floor(cols / 9));
  for (let i = 0; i < bays; i++) {
    const c = 1 + Math.floor(random() * Math.max(1, cols - 2));
    const extra = 1 + Math.floor(random() * 2);
    for (let dc = -2; dc <= 2; dc++) {
      const cc = c + dc;
      if (cc < 0 || cc >= cols) continue;
      const bump = extra - Math.abs(dc);
      if (bump > 0) {
        depths[cc] = Math.min(MARE_PROFONDITA_BAIA, (depths[cc] ?? MARE_PROFONDITA_MIN) + bump);
      }
    }
  }

  const caps = Math.max(1, Math.floor(cols / 11));
  for (let i = 0; i < caps; i++) {
    const c = 1 + Math.floor(random() * Math.max(1, cols - 2));
    for (let dc = -1; dc <= 1; dc++) {
      const cc = c + dc;
      if (cc < 0 || cc >= cols) continue;
      depths[cc] = Math.max(
        MARE_PROFONDITA_MIN,
        (depths[cc] ?? MARE_PROFONDITA_MIN) - (dc === 0 ? 2 : 1)
      );
    }
  }

  for (let c = 0; c < cols; c++) {
    depths[c] = Math.max(1, depths[c] ?? MARE_PROFONDITA_MIN);
  }
  return depths;
}

export function isMareConProfondita(
  index: number,
  cols: number,
  rows: number,
  depths: readonly number[]
): boolean {
  if (cols < 1 || rows < 1) return false;
  const row = Math.floor(index / cols);
  const col = index % cols;
  if (col < 0 || col >= cols || row < 0 || row >= rows) return false;
  const d = depths[col] ?? MARE_PROFONDITA_MIN;
  return row >= rows - d;
}

/** Mare attivo (costa in sessione) oppure fallback: sole ultime `MARE_PROFONDITA_MIN` righe. */
export function isMareAttivo(index: number, cols: number, rows: number): boolean {
  if (activeCostaSud && activeCostaSud.length === cols) {
    return isMareConProfondita(index, cols, rows, activeCostaSud);
  }
  const row = Math.floor(index / cols);
  return row >= rows - MARE_PROFONDITA_MIN;
}

export function normalizzaProfonditaCostaSud(
  depths: unknown,
  cols: number,
  rows: number
): number[] | null {
  if (!Array.isArray(depths) || depths.length !== cols) return null;
  const maxD = Math.max(1, Math.min(MARE_PROFONDITA_BAIA, rows - 4));
  const out: number[] = [];
  for (let i = 0; i < cols; i++) {
    const v = depths[i];
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    out.push(Math.max(1, Math.min(maxD, Math.trunc(v))));
  }
  return out;
}

/** Prima cella di terra sopra il mare in una colonna (o null). */
export function cellaTerraSopraMare(
  col: number,
  cols: number,
  rows: number,
  depths: readonly number[]
): number | null {
  if (col < 0 || col >= cols) return null;
  const d = depths[col] ?? MARE_PROFONDITA_MIN;
  const row = rows - d - 1;
  if (row < 0 || row >= rows) return null;
  return row * cols + col;
}

/**
 * Assicura `costaSudProfondita` e rimuove edifici/decor/terreno sulle celle mare
 * (non tocca il Bosco a nord).
 */
export function migraMappaCostaSud(
  state: MappaRuntimeState,
  cols: number,
  rows: number,
  random: () => number = Math.random
): MappaRuntimeState {
  const existing = normalizzaProfonditaCostaSud(state.costaSudProfondita, cols, rows);
  if (existing) {
    const prev = state.costaSudProfondita;
    if (
      Array.isArray(prev) &&
      prev.length === cols &&
      prev.every((d, i) => d === existing[i])
    ) {
      return state;
    }
    return { ...state, costaSudProfondita: existing };
  }

  const costaSudProfondita = generaProfonditaCostaSud(cols, random);
  const edificiInMappa = { ...state.edificiInMappa };
  const terrenoInMappa = { ...state.terrenoInMappa };
  const decorazioniInMappa = { ...state.decorazioniInMappa };
  const residenzeMappa = { ...(state.residenzeMappa ?? {}) };

  for (let col = 0; col < cols; col++) {
    const d = costaSudProfondita[col] ?? MARE_PROFONDITA_MIN;
    for (let row = rows - d; row < rows; row++) {
      if (row < 0) continue;
      const i = row * cols + col;
      const e = edificiInMappa[i];
      if (e?.nome === NOME_BOSCO) continue;
      if (e) {
        if (e.footprintRef == null && e.footprint) {
          const w = e.footprint.w;
          const h = e.footprint.h;
          const ac = i % cols;
          const ar = Math.floor(i / cols);
          for (let dr = 0; dr < h; dr++) {
            for (let dc = 0; dc < w; dc++) {
              delete edificiInMappa[(ar + dr) * cols + (ac + dc)];
            }
          }
        } else {
          delete edificiInMappa[i];
        }
        delete residenzeMappa[i];
      }
      delete terrenoInMappa[i];
      delete decorazioniInMappa[i];
    }
  }

  return {
    ...state,
    costaSudProfondita,
    edificiInMappa,
    terrenoInMappa,
    decorazioniInMappa,
    residenzeMappa
  };
}
