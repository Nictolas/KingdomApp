import type { Abitante, Edificio } from "../types";
import { isGiocatore } from "./schiavituCommercio";
import { getCastaAbitante } from "./casta";
import { getLavoroPerEdificio } from "./edificiLavoro";

export const NOME_EMPORIO = "Emporio";
export const CAPACITA_COMMERCIANTI_EMPORIO = 4;

export function trovaEmporioOperativo(edifici: Edificio[]): Edificio | undefined {
  return edifici.find((e) => e.nome === NOME_EMPORIO && e.stato === "Operativo");
}

export function postiLiberiEmporio(edificio: Edificio): number {
  if (edificio.nome !== NOME_EMPORIO || edificio.stato !== "Operativo") return 0;
  const cap = Math.min(edificio.capacità ?? CAPACITA_COMMERCIANTI_EMPORIO, CAPACITA_COMMERCIANTI_EMPORIO);
  const usati = (edificio.abitantiAssegnati ?? []).length;
  return Math.max(0, cap - usati);
}

export function emporioHaPostoLibero(edifici: Edificio[]): Edificio | undefined {
  const emporio = trovaEmporioOperativo(edifici);
  if (!emporio || postiLiberiEmporio(emporio) <= 0) return undefined;
  return emporio;
}

export function disoccupatoIdoneoPerEmporio(abitante: Abitante): boolean {
  if (isGiocatore(abitante)) return false;
  if (getCastaAbitante(abitante) === "Nobile") return false;
  if (abitante.lavoro !== "Disoccupato") return false;
  if (abitante.razza === "Golem") return false;
  return true;
}

export function assumiDisoccupatoInEmporio(
  abitanti: Abitante[],
  edifici: Edificio[],
  abitanteId: number
): { abitanti: Abitante[]; edifici: Edificio[]; ok: boolean; emporioId?: number } {
  const ab = abitanti.find((a) => a.id === abitanteId);
  const emporio = emporioHaPostoLibero(edifici);
  if (!ab || !emporio || !disoccupatoIdoneoPerEmporio(ab)) return { abitanti, edifici, ok: false };
  if ((emporio.abitantiAssegnati ?? []).includes(abitanteId)) return { abitanti, edifici, ok: false };

  const edificiNext = edifici.map((e) => {
    if (e.id !== emporio.id) return e;
    const ids = [...(e.abitantiAssegnati ?? []), abitanteId];
    return { ...e, abitantiAssegnati: ids, occupazione: ids.length };
  });
  const lavoro = getLavoroPerEdificio(emporio) ?? "Mercante";
  const abitantiNext = abitanti.map((a) => (a.id === abitanteId ? { ...a, lavoro } : a));
  return { abitanti: abitantiNext, edifici: edificiNext, ok: true, emporioId: emporio.id };
}
