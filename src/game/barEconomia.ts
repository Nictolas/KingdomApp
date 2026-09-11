import type { Abitante, Edificio } from "../types";
import { COSTO_BAR_MONETE } from "./economiaPrezzi";
import { getCastaAbitante } from "./casta";
import { getLavoroPerEdificio } from "./edificiLavoro";
import {
  getMoneteInventarioAbitante,
  provaSpendiMoneteInventarioAbitante
} from "./inventario";
import { primoEdificioLavoroOrarioPerAbitante } from "./orariLavoroMappa";
import { isGiocatore } from "./schiavituCommercio";

export { COSTO_BAR_MONETE };

/** True se l’abitante ha almeno il costo d’ingresso al Bar. */
export function abitantePuoEntrareAlBar(abitante: Abitante): boolean {
  return getMoneteInventarioAbitante(abitante.inventario) >= COSTO_BAR_MONETE;
}

/**
 * Paga 1 moneta per una Birra al Bar (scorte infinite).
 * Non muta i bisogni: applicare `applicaRecuperoBar` sul risultato.
 */
export function pagaIngressoBar(abitante: Abitante): Abitante | null {
  return provaSpendiMoneteInventarioAbitante(abitante, COSTO_BAR_MONETE);
}

/** Id oggetto catalogo «Birra» (scorte infinite al Bar). */
export const ITEM_BIRRA_BAR = "birra";
export const NOME_BIRRA_BAR = "Birra";
export const EMOJI_BIRRA_BAR = "🍺";

const LAVORI_ASSUMIBILI_BAR_VUOTO = new Set(["Disoccupato", "Raccoglitore"]);

/** Chi può diventare Barista entrando in un Bar senza lavoratori. */
export function abitantePuoDiventareBaristaAlVolo(abitante: Abitante): boolean {
  if (isGiocatore(abitante)) return false;
  if (abitante.razza === "Golem") return false;
  if (!LAVORI_ASSUMIBILI_BAR_VUOTO.has(abitante.lavoro)) return false;
  const casta = getCastaAbitante(abitante);
  // Servi/schiavi solo per assegnazione manuale.
  return casta === "Cittadino" || casta === "Nobile";
}

/**
 * Se il Bar non ha lavoratori, il primo entrante idoneo diventa Barista
 * (non cliente). Rimuove eventuali assegnazioni lavoro precedenti.
 */
export function provaAssumiPrimoArrivoComeBaristaSeVuoto(
  abitanti: Abitante[],
  edifici: Edificio[],
  abitanteId: number,
  barEdificioId: number
): { abitanti: Abitante[]; edifici: Edificio[]; assunto: boolean } {
  const bar = edifici.find((e) => e.id === barEdificioId);
  const ab = abitanti.find((a) => a.id === abitanteId);
  if (!bar || !ab || bar.nome !== "Bar" || bar.stato !== "Operativo") {
    return { abitanti, edifici, assunto: false };
  }
  const assegnati = bar.abitantiAssegnati ?? [];
  if (assegnati.length > 0) return { abitanti, edifici, assunto: false };
  if ((bar.capacità ?? 0) <= 0) return { abitanti, edifici, assunto: false };
  if (!abitantePuoDiventareBaristaAlVolo(ab)) {
    return { abitanti, edifici, assunto: false };
  }

  const lavoro = getLavoroPerEdificio(bar) ?? "Barista";
  const edificiNext = edifici.map((e) => {
    if (e.id === barEdificioId) {
      return {
        ...e,
        abitantiAssegnati: [abitanteId],
        occupazione: 1
      };
    }
    if (!(e.abitantiAssegnati ?? []).includes(abitanteId)) return e;
    if (getLavoroPerEdificio(e) == null) return e;
    const ids = (e.abitantiAssegnati ?? []).filter((id) => id !== abitanteId);
    return { ...e, abitantiAssegnati: ids, occupazione: ids.length };
  });
  const abitantiNext = abitanti.map((a) =>
    a.id === abitanteId ? { ...a, lavoro } : a
  );
  return { abitanti: abitantiNext, edifici: edificiNext, assunto: true };
}

/** Id del Bar a cui l’abitante è assegnato come lavoratore, se esiste. */
export function barEdificioIdDiLavoratore(
  abitanteId: number,
  edifici: Edificio[]
): number | null {
  const sede = primoEdificioLavoroOrarioPerAbitante(abitanteId, edifici);
  return sede?.nome === "Bar" ? sede.id : null;
}

export function abitanteLavoraInUnBar(abitanteId: number, edifici: Edificio[]): boolean {
  return barEdificioIdDiLavoratore(abitanteId, edifici) != null;
}

/** Raggruppa i lavoratori in servizio per Bar di assegnazione. */
export function raggruppaBaristiInServizioPerBar(
  lavoratoreIds: Iterable<number>,
  edifici: Edificio[]
): Record<number, number[]> {
  const out: Record<number, number[]> = {};
  for (const id of lavoratoreIds) {
    const barId = barEdificioIdDiLavoratore(id, edifici);
    if (barId == null) continue;
    (out[barId] ??= []).push(id);
  }
  return out;
}
