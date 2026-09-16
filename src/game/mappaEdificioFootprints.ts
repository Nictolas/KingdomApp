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

/** Indici delle celle che contengono giacimenti. */
export function giacimentoIndicesDaEdifici(
  edificiInMappa: Record<number, { nome: string }>
): Set<number> {
  return new Set(
    Object.keys(edificiInMappa)
      .map(Number)
      .filter((i) => edificiInMappa[i]?.nome === "Giacimento")
  );
}

/** Rimuove tutte le celle appartenenti a un footprint rettangolare. */
export function rimuoviFootprintEdificioDaMappa<T>(
  out: Record<number, T>,
  anchor: number,
  w: number,
  h: number,
  cols: number
): void {
  for (const i of getIndiciFootprint(anchor, w, h, cols)) {
    delete out[i];
  }
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
