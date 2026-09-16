import {
  FOOTPRINT_COSTRUZIONE,
  type MappaCostruzioneFootprint
} from "./mappaCostruzioneFootprints";
import { getIndiciFootprint } from "./mappaGeometry";

export type MappaEdificioFootprintEntry = {
  nome: string;
  footprintRef?: number;
  footprint?: MappaCostruzioneFootprint;
};

/** Dimensioni effettive del footprint di un edificio presente sulla mappa. */
export function dimensioniFootprintEdificioInMappa(
  anchor: number,
  edificiInMappa: Record<number, MappaEdificioFootprintEntry>
): MappaCostruzioneFootprint {
  const cap = edificiInMappa[anchor];
  if (!cap) return { w: 1, h: 1 };
  if (cap.footprint) return cap.footprint;
  return FOOTPRINT_COSTRUZIONE[cap.nome] ?? { w: 1, h: 1 };
}

/** Celle occupate dagli edifici iniziali e quindi protette dalla demolizione. */
export function indiciFootprintProtettiIniziali(
  edificiIniziali: Record<number, MappaEdificioFootprintEntry>,
  cols: number
): Set<number> {
  const protetti = new Set<number>();
  for (const idxStr of Object.keys(edificiIniziali)) {
    const idx = Number(idxStr);
    const e = edificiIniziali[idx];
    if (!e || e.footprintRef != null) continue;
    const { w, h } = dimensioniFootprintEdificioInMappa(idx, edificiIniziali);
    for (const i of getIndiciFootprint(idx, w, h, cols)) protetti.add(i);
  }
  return protetti;
}
