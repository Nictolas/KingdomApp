import { getIndiciCuscinoErba, getIndiciFootprint } from "./mappaGeometry";

/** Aggiunge a `vietato` il footprint e il cuscino di una cella che lo circonda. */
export function estendiVietatoConFootprintECuscino(
  anchor: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  vietato: Set<number>
): void {
  for (const i of getIndiciFootprint(anchor, w, h, cols)) vietato.add(i);
  for (const i of getIndiciCuscinoErba(anchor, w, h, cols, rows)) vietato.add(i);
}
