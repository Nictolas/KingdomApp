import type { EdificioInCellaMappa } from "./mappaTypes";

/**
 * Coppie [indiceA, indiceB] per le strade iniziali, basate sulle ancore effettive
 * degli edifici già piazzati sulla mappa.
 */
export function getStradeIniziali(
  edificiInMappa: Record<number, EdificioInCellaMappa>
): [number, number][] {
  let centro: number | null = null;
  let spazioporto: number | null = null;
  let bar: number | null = null;
  let tribunale: number | null = null;
  const serre: number[] = [];

  for (const [i, e] of Object.entries(edificiInMappa)) {
    const idx = Number(i);
    if (e.nome === "Centro di Comando" && e.footprint && !e.footprintRef) centro = idx;
    if (e.nome === "Spazioporto" && e.footprint && !e.footprintRef) spazioporto = idx;
    if (e.nome === "Serra" && e.footprint && !e.footprintRef) serre.push(idx);
    if (e.nome === "Bar" && e.footprint && !e.footprintRef) bar = idx;
    if (e.nome === "Tribunale" && e.footprint && !e.footprintRef) tribunale = idx;
  }

  const out: [number, number][] = [];
  if (centro != null && spazioporto != null) out.push([centro, spazioporto]);
  if (centro != null) {
    for (const sa of serre) out.push([centro, sa]);
  }
  if (centro != null && tribunale != null) out.push([centro, tribunale]);
  if (centro != null && bar != null) out.push([centro, bar]);
  return out;
}
