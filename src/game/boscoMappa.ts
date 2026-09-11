import type { EdificioInCellaMappa, MappaRuntimeState } from "./mappaTypes";
import { NOME_BOSCO } from "./buildingGeometry";
import { generateSingleRiverNordToMare } from "./riverGeneration";
import { isMareAttivo, setActiveCostaSud } from "./mareCosta";

/** Altezza fissa dei rettangoli Bosco (celle). */
export const BOSCO_STRISCIA_H = 2;

/** Id edificio globale Bosco nel catalogo. */
export const BOSCO_EDIFICIO_ID = 51;

/** Layout: fiume unico nord→mare + Bosco in due pezzi + sabbia sulle rive. */
export const MAPPA_LAYOUT_BOSCO_FIUME = 3;

function getIndiciFootprint(anchor: number, w: number, h: number, cols: number): number[] {
  const col = anchor % cols;
  const row = Math.floor(anchor / cols);
  const out: number[] = [];
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      out.push((row + dr) * cols + (col + dc));
    }
  }
  return out;
}

function piazzaRettangoloBosco(
  out: Record<number, EdificioInCellaMappa>,
  anchor: number,
  w: number,
  h: number,
  cols: number,
  boscoId: number
): void {
  if (w < 1 || h < 1) return;
  for (const i of getIndiciFootprint(anchor, w, h, cols)) {
    if (i === anchor) {
      out[i] = {
        id: boscoId,
        nome: NOME_BOSCO,
        emoji: "",
        footprint: { w, h }
      };
    } else {
      out[i] = {
        id: boscoId,
        nome: NOME_BOSCO,
        emoji: "",
        footprintRef: anchor
      };
    }
  }
}

/** Colonna del varco fiume tra i due Bosco (riga 0), o null se layout assente. */
export function trovaColonnaVarcoBosco(
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  terrenoInMappa: Record<number, string | undefined>,
  cols: number
): number | null {
  if (cols < 5) return null;
  for (let c = 2; c < cols - 2; c++) {
    const cell = c;
    const left = edificiInMappa[c - 1];
    const right = edificiInMappa[c + 1];
    const midEd = edificiInMappa[cell];
    if (midEd?.nome === NOME_BOSCO) continue;
    if (left?.nome !== NOME_BOSCO || right?.nome !== NOME_BOSCO) continue;
    if ((terrenoInMappa[cell] ?? "erba") === "river") return c;
  }
  return null;
}

/** True se ci sono esattamente due anchor Bosco sulla riga nord con un varco di 1 cella. */
export function boscoHaFormaDueRettangoli(
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  cols: number
): boolean {
  const anchors: { anchor: number; w: number; h: number }[] = [];
  for (const key of Object.keys(edificiInMappa)) {
    const i = Number(key);
    const e = edificiInMappa[i];
    if (!e || e.nome !== NOME_BOSCO || e.footprintRef != null) continue;
    if (Math.floor(i / cols) !== 0) continue;
    anchors.push({
      anchor: i,
      w: e.footprint?.w ?? 1,
      h: e.footprint?.h ?? BOSCO_STRISCIA_H
    });
  }
  if (anchors.length !== 2) return false;
  const [a, b] = anchors[0]!.anchor < anchors[1]!.anchor ? anchors : [anchors[1]!, anchors[0]!];
  if (a.h !== BOSCO_STRISCIA_H || b.h !== BOSCO_STRISCIA_H) return false;
  const aEnd = (a.anchor % cols) + a.w;
  const bStart = b.anchor % cols;
  return bStart === aEnd + 1 && bStart + b.w === cols;
}

/**
 * Piazza due rettangoli Bosco a nord, separati dalla colonna `gapCol` (fiume).
 */
export function applicaBoscoDueRettangoli(
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  cols: number,
  rows: number,
  gapCol: number,
  boscoId = BOSCO_EDIFICIO_ID
): Record<number, EdificioInCellaMappa> {
  if (cols < 5 || rows < 1) return edificiInMappa;
  const gap = Math.max(2, Math.min(cols - 3, gapCol));
  const out: Record<number, EdificioInCellaMappa> = { ...edificiInMappa };

  for (const key of Object.keys(out)) {
    const i = Number(key);
    if (out[i]?.nome === NOME_BOSCO) delete out[i];
  }

  const hStrip = Math.min(BOSCO_STRISCIA_H, rows);
  const toClear = new Set<number>();
  for (let r = 0; r < hStrip; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const e = out[i];
      if (!e) continue;
      if (e.footprintRef != null) {
        toClear.add(i);
        continue;
      }
      const w = e.footprint?.w ?? 1;
      const h = e.footprint?.h ?? 1;
      for (const cell of getIndiciFootprint(i, w, h, cols)) toClear.add(cell);
    }
  }
  for (const i of toClear) delete out[i];

  const leftW = gap;
  const rightAnchor = gap + 1;
  const rightW = cols - rightAnchor;
  piazzaRettangoloBosco(out, 0, leftW, hStrip, cols, boscoId);
  piazzaRettangoloBosco(out, rightAnchor, rightW, hStrip, cols, boscoId);
  return out;
}

/** Rimuove Dissalatore / Acquedotto dalle celle mappa. */
export function rimuoviDissalatoreDaMappa(
  edificiInMappa: Record<number, EdificioInCellaMappa>
): Record<number, EdificioInCellaMappa> {
  const out: Record<number, EdificioInCellaMappa> = { ...edificiInMappa };
  for (const key of Object.keys(out)) {
    const i = Number(key);
    const n = out[i]?.nome;
    if (n === "Acquedotto" || n === "Dissalatore") delete out[i];
  }
  return out;
}

/** Rimuove edifici (intero footprint) che toccano celle fiume. Restituisce le Miniera rimosse da ripiazzare. */
function rimuoviEdificiSuFiume(
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  riverSet: Set<number>,
  cols: number
): { edifici: Record<number, EdificioInCellaMappa>; miniereDaRipiazzare: number } {
  const out: Record<number, EdificioInCellaMappa> = { ...edificiInMappa };
  let miniereDaRipiazzare = 0;
  const anchorsToClear = new Set<number>();

  for (const key of Object.keys(out)) {
    const i = Number(key);
    if (!riverSet.has(i)) continue;
    const e = out[i];
    if (!e || e.nome === NOME_BOSCO) continue;
    if (e.nome === "Strada") {
      delete out[i];
      continue;
    }
    anchorsToClear.add(e.footprintRef != null ? e.footprintRef : i);
  }

  for (const anchor of anchorsToClear) {
    const head = out[anchor];
    const sample =
      head ??
      (Object.values(out).find((v) => v.footprintRef === anchor) as EdificioInCellaMappa | undefined);
    if (sample?.nome === "Miniera") miniereDaRipiazzare++;

    if (head?.footprint) {
      for (const cell of getIndiciFootprint(anchor, head.footprint.w, head.footprint.h, cols)) {
        delete out[cell];
      }
    } else {
      for (const key of Object.keys(out)) {
        const i = Number(key);
        const cell = out[i];
        if (i === anchor || cell?.footprintRef === anchor) delete out[i];
      }
    }
  }

  return { edifici: out, miniereDaRipiazzare };
}

function ripiazzaMiniere(
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  riverSet: Set<number>,
  cols: number,
  rows: number,
  n: number
): Record<number, EdificioInCellaMappa> {
  if (n <= 0) return edificiInMappa;
  const out = { ...edificiInMappa };
  const candidati: number[] = [];
  for (let i = 0; i < cols * rows; i++) {
    if (isMareAttivo(i, cols, rows)) continue;
    if (riverSet.has(i)) continue;
    if (out[i]) continue;
    // Evita riva immediata del fiume (cuscino 1).
    const r = Math.floor(i / cols);
    const c = i % cols;
    let vicinoFiume = false;
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ] as const) {
      const r2 = r + dr;
      const c2 = c + dc;
      if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
      if (riverSet.has(r2 * cols + c2)) {
        vicinoFiume = true;
        break;
      }
    }
    if (vicinoFiume) continue;
    candidati.push(i);
  }
  // Shuffle semplice
  for (let i = candidati.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = candidati[i]!;
    candidati[i] = candidati[j]!;
    candidati[j] = tmp;
  }
  let placed = 0;
  for (const cell of candidati) {
    if (placed >= n) break;
    if (out[cell]) continue;
    out[cell] = { id: 3, nome: "Miniera", emoji: "⛏️" };
    placed++;
  }
  return out;
}

/**
 * Migra a layout v3: fiume nord→mare, Bosco in due pezzi, sabbia sulle rive, niente edifici sul fiume.
 */
export function migraMappaBoscoDueRettangoliEFiume(
  state: MappaRuntimeState,
  cols: number,
  rows: number,
  random: () => number = Math.random
): MappaRuntimeState {
  if (
    state.mappaLayoutVersion === MAPPA_LAYOUT_BOSCO_FIUME &&
    boscoHaFormaDueRettangoli(state.edificiInMappa, cols)
  ) {
    return {
      ...state,
      residenzeMappa: state.residenzeMappa ?? {},
      mappaLayoutVersion: MAPPA_LAYOUT_BOSCO_FIUME
    };
  }

  if (state.costaSudProfondita) setActiveCostaSud(state.costaSudProfondita);

  const forbidden = new Set<number>();
  for (const key of Object.keys(state.edificiInMappa)) {
    const i = Number(key);
    const e = state.edificiInMappa[i];
    if (!e || e.nome === NOME_BOSCO) continue;
    if (e.nome === "Acquedotto" || e.nome === "Dissalatore") continue;
    forbidden.add(i);
  }
  for (let i = 0; i < cols * rows; i++) {
    if (isMareAttivo(i, cols, rows)) forbidden.add(i);
  }

  const { riverIndices, gapCol } = generateSingleRiverNordToMare({
    cols,
    rows,
    boscoH: BOSCO_STRISCIA_H,
    forbiddenIndices: forbidden,
    random
  });
  const riverSet = new Set(riverIndices);

  let edificiInMappa = rimuoviDissalatoreDaMappa(state.edificiInMappa);
  edificiInMappa = applicaBoscoDueRettangoli(edificiInMappa, cols, rows, gapCol);

  const puliti = rimuoviEdificiSuFiume(edificiInMappa, riverSet, cols);
  edificiInMappa = ripiazzaMiniere(
    puliti.edifici,
    riverSet,
    cols,
    rows,
    puliti.miniereDaRipiazzare
  );

  const terrenoInMappa: Record<number, "erba" | "river" | "sabbia"> = {};
  for (const [k, v] of Object.entries(state.terrenoInMappa)) {
    const i = Number(k);
    if (v === "river" || v === "sabbia") continue;
    if (riverSet.has(i)) continue;
    if (edificiInMappa[i]?.nome === NOME_BOSCO) continue;
    terrenoInMappa[i] = v;
  }
  for (const i of riverIndices) {
    if (!isMareAttivo(i, cols, rows)) terrenoInMappa[i] = "river";
  }

  // Sabbia a riva di mare e fiume.
  for (let i = 0; i < cols * rows; i++) {
    if (isMareAttivo(i, cols, rows)) continue;
    if (terrenoInMappa[i] === "river") continue;
    if (edificiInMappa[i]) continue;
    const r = Math.floor(i / cols);
    const c = i % cols;
    let vicinoAcqua = false;
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ] as const) {
      const r2 = r + dr;
      const c2 = c + dc;
      if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
      const j = r2 * cols + c2;
      if (isMareAttivo(j, cols, rows) || terrenoInMappa[j] === "river") {
        vicinoAcqua = true;
        break;
      }
    }
    if (vicinoAcqua) terrenoInMappa[i] = "sabbia";
  }

  const decorazioniInMappa = { ...state.decorazioniInMappa };
  const hStrip = Math.min(BOSCO_STRISCIA_H, rows);
  for (let i = 0; i < cols * hStrip; i++) delete decorazioniInMappa[i];
  for (const i of riverIndices) delete decorazioniInMappa[i];
  for (let i = 0; i < cols * rows; i++) {
    if (terrenoInMappa[i] === "sabbia") delete decorazioniInMappa[i];
  }

  return {
    ...state,
    edificiInMappa,
    terrenoInMappa,
    decorazioniInMappa,
    residenzeMappa: state.residenzeMappa ?? {},
    mappaLayoutVersion: MAPPA_LAYOUT_BOSCO_FIUME
  };
}

/** @deprecated Usa migraMappaBoscoDueRettangoliEFiume. */
export function migraMappaBoscoStrisciaNord(
  state: MappaRuntimeState,
  cols: number,
  rows: number
): MappaRuntimeState {
  return migraMappaBoscoDueRettangoliEFiume(state, cols, rows);
}

/** @deprecated */
export function boscoHaFormaStrisciaNord(
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  cols: number
): boolean {
  return boscoHaFormaDueRettangoli(edificiInMappa, cols);
}

/** @deprecated */
export function applicaBoscoStrisciaNord(
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  cols: number,
  rows: number,
  boscoId = BOSCO_EDIFICIO_ID
): Record<number, EdificioInCellaMappa> {
  const mid = Math.floor(cols / 2);
  return applicaBoscoDueRettangoli(edificiInMappa, cols, rows, mid, boscoId);
}
