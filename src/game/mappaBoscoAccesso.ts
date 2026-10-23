import type { MappaRuntimeState } from "./mappaTypes";
import { isAcqua } from "./mappaGeometry";
import { cellaNellaForestaNord } from "./mappaForestaConfine";

/** Verifica che il cammino dalla fascia sud del Bosco al Castello sia percorribile.
 * Solo in mancanza di collegamento apre un guado erboso attraverso il minor
 * numero possibile di celle fiume. Non cambia mai edifici, strade o decorazioni.
 */
export function assicuraAccessoPedonaleBosco(
  state: MappaRuntimeState,
  cols: number,
  rows: number
): MappaRuntimeState {
  const entries = Object.entries(state.edificiInMappa)
    .map(([index, value]) => ({ index: Number(index), value }));
  const bosco = entries.find(e => e.value.nome === "Bosco" && e.value.footprint && e.value.footprintRef == null);
  const castello = entries.find(e => e.value.nome === "Castello" && e.value.footprintRef == null);
  if (!bosco || !castello || !bosco.value.footprint) return state;

  const terreno = state.terrenoInMappa;
  const total = cols * rows;
  const allowed = (index: number): boolean =>
    index >= 0 && index < total &&
    !isAcqua(index, cols, rows) &&
    !cellaNellaForestaNord(index, cols, rows) &&
    !state.decorazioniInMappa[index] &&
    (!state.edificiInMappa[index] || state.edificiInMappa[index]?.nome === "Strada");

  const adjacent = (i: number): number[] => {
    const r = Math.floor(i / cols), c = i % cols;
    const out: number[] = [];
    if (r > 0) out.push(i - cols);
    if (r + 1 < rows) out.push(i + cols);
    if (c > 0) out.push(i - 1);
    if (c + 1 < cols) out.push(i + 1);
    return out;
  };
  const entranceRow = Math.floor(bosco.index / cols) + bosco.value.footprint.h;
  const entranceCol = bosco.index % cols;
  const start = Array.from({ length: bosco.value.footprint.w }, (_, n) =>
    entranceRow * cols + entranceCol + n
  ).filter(allowed);
  if (start.length === 0) return state;

  const castleFootprint = castello.value.footprint ?? { w: 1, h: 1 };
  const castleCells = new Set<number>();
  for (let dr = 0; dr < castleFootprint.h; dr++) {
    for (let dc = 0; dc < castleFootprint.w; dc++) {
      const r = Math.floor(castello.index / cols) + dr, c = castello.index % cols + dc;
      if (r < rows && c < cols) castleCells.add(r * cols + c);
    }
  }
  const goals = new Set<number>();
  for (const i of castleCells) {
    for (const n of adjacent(i)) if (!castleCells.has(n) && allowed(n)) goals.add(n);
  }
  if (!goals.size) return state;

  // Dijkstra: attraversare un fiume costa molto più di camminare su terra.
  // Se esiste già un itinerario asciutto, il costo non richiederà modifiche.
  const dist = new Array<number>(total).fill(Infinity);
  const prev = new Array<number>(total).fill(-1);
  const visited = new Uint8Array(total);
  for (const cell of start) dist[cell] = 0;

  let destination = -1;
  for (let pass = 0; pass < total; pass++) {
    let best = -1, score = Infinity;
    for (let i = 0; i < total; i++) {
      if (!visited[i] && dist[i] < score) { best = i; score = dist[i]; }
    }
    if (best === -1) break;
    if (goals.has(best)) { destination = best; break; }
    visited[best] = 1;
    for (const n of adjacent(best)) {
      if (!allowed(n) || visited[n]) continue;
      const costo = terreno[n] === "river" ? 100 : 1;
      const candidate = dist[best] + costo;
      if (candidate < dist[n]) { dist[n] = candidate; prev[n] = best; }
    }
  }
  if (destination < 0) return state;

  const riverToGrass: number[] = [];
  for (let at = destination; at >= 0; at = prev[at]!) {
    if (terreno[at] === "river") riverToGrass.push(at);
  }
  if (riverToGrass.length === 0) return state;
  const nextTerrain = { ...terreno };
  for (const index of riverToGrass) delete nextTerrain[index];
  return { ...state, terrenoInMappa: nextTerrain };
}
