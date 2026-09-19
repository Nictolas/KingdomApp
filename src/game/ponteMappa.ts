import type { Edificio } from "../types";
import type { TerrenoType } from "./riverGeneration";
import type { EdificioInCellaMappa } from "./mappaTypes";

export const NOME_PONTE = "Ponte";
export const PONTE_EMOJI = "🌉";
/** Id catalogo in `edificiData` (istanza creata al piazzamento). */
export const ID_TEMPLATE_PONTE = 53;
/** Costo in monete (Tesoro) per piazzare un Ponte (cantiere). */
export const COSTO_PONTE_MONETE = 100;

export const PONTE_OPZIONE = {
  id: ID_TEMPLATE_PONTE,
  nome: NOME_PONTE,
  emoji: PONTE_EMOJI
} as const;

/** Cella di fiume libera, idonea a un ponte (1×1). */
export function isCellaOkPerPonte(
  index: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, Pick<EdificioInCellaMappa, "nome">>
): boolean {
  if ((terrenoInMappa[index] ?? "erba") !== "river") return false;
  if (edificiInMappa[index]) return false;
  return true;
}

/** True se sulla mappa c’è almeno un Ponte (cantiere o pronto). */
export function mappaHaPonteSulFiume(
  edificiInMappa: Record<number, Pick<EdificioInCellaMappa, "nome">>
): boolean {
  return Object.values(edificiInMappa).some((e) => e?.nome === NOME_PONTE);
}

/**
 * True se esiste un Ponte operativo (attraversabile).
 * I ponti legacy senza istanza globale contano come già pronti.
 */
export function mappaHaPonteOperativo(
  edificiInMappa: Record<number, Pick<EdificioInCellaMappa, "nome" | "id" | "edificioGlobaleId">>,
  edifici: readonly Pick<Edificio, "id" | "nome" | "stato">[]
): boolean {
  for (const e of Object.values(edificiInMappa)) {
    if (e?.nome !== NOME_PONTE) continue;
    if (ponteCellaAttraversabile(e, edifici)) return true;
  }
  return false;
}

/** Ponte pronto da attraversare (non in cantiere). */
export function ponteCellaAttraversabile(
  e: Pick<EdificioInCellaMappa, "nome" | "id" | "edificioGlobaleId"> | undefined,
  edifici: readonly Pick<Edificio, "id" | "nome" | "stato">[]
): boolean {
  if (!e || e.nome !== NOME_PONTE) return false;
  const gid = e.edificioGlobaleId ?? e.id;
  const globale = edifici.find((x) => x.id === gid && x.nome === NOME_PONTE);
  if (globale) return globale.stato === "Operativo";
  // Legacy: cella Ponte senza istanza in `edifici` → già attraversabile.
  return true;
}

export function piazzaPonteSuCella(
  cellIndex: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  opts?: { edificioGlobaleId: number }
): boolean {
  if (!isCellaOkPerPonte(cellIndex, terrenoInMappa, edificiInMappa)) return false;
  const edificioGlobaleId = opts?.edificioGlobaleId;
  edificiInMappa[cellIndex] = {
    id: edificioGlobaleId ?? ID_TEMPLATE_PONTE,
    nome: NOME_PONTE,
    emoji: PONTE_EMOJI,
    ...(edificioGlobaleId != null ? { edificioGlobaleId } : {}),
    footprint: { w: 1, h: 1 }
  };
  return true;
}
