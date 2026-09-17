import {
  FOOTPRINT_COSTRUZIONE,
  type MappaCostruzioneFootprint
} from "./mappaCostruzioneFootprints";
import { getIndiciFootprint } from "./mappaGeometry";
import { ADMIN_FOOTPRINT_H, ADMIN_FOOTPRINT_W } from "./mappaLayoutConfig";
import type { EdificioInCellaMappa } from "./mappaTypes";

export type MappaEdificioFootprintEntry = {
  nome: string;
  footprintRef?: number;
  footprint?: MappaCostruzioneFootprint;
};

/** Scrive il footprint 3×2 del Complesso amministrativo su un anchor già scelto. */
export function aggiungiComplessoAmministrativo(
  cols: number,
  rows: number,
  out: Record<number, EdificioInCellaMappa>,
  anchor: number
): void {
  const w = ADMIN_FOOTPRINT_W;
  const h = ADMIN_FOOTPRINT_H;
  const celle = getIndiciFootprint(anchor, w, h, cols);
  const anchorEd: EdificioInCellaMappa = {
    id: 1,
    nome: "Centro di Comando",
    emoji: "🏛️",
    footprint: { w, h }
  };
  out[anchor] = anchorEd;
  for (const i of celle) {
    if (i === anchor) continue;
    out[i] = { id: 1, nome: "Centro di Comando", emoji: "", footprintRef: anchor };
  }
  void rows;
}

/** Scrive un edificio 1×1 o multi-cella sulla griglia a partire da un anchor già scelto. */
export function applicaEdificioFootprintCostruzione(
  out: Record<number, EdificioInCellaMappa>,
  anchor: number,
  w: number,
  h: number,
  cols: number,
  base: { id: number; nome: string; emoji: string; edificioGlobaleId?: number }
): void {
  const celle = getIndiciFootprint(anchor, w, h, cols);
  if (w === 1 && h === 1) {
    out[anchor] = {
      id: base.id,
      nome: base.nome,
      emoji: base.emoji,
      edificioGlobaleId: base.edificioGlobaleId
    };
    return;
  }
  out[anchor] = {
    id: base.id,
    nome: base.nome,
    emoji: "",
    footprint: { w, h },
    edificioGlobaleId: base.edificioGlobaleId
  };
  for (const i of celle) {
    if (i === anchor) continue;
    out[i] = {
      id: base.id,
      nome: base.nome,
      emoji: "",
      footprintRef: anchor,
      edificioGlobaleId: base.edificioGlobaleId
    };
  }
}

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
