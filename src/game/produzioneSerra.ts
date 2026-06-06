import type { Edificio } from "../types";
import type { VoceInventario } from "./inventario";
import { aggiungiCiboAInventarioGiocatore } from "./inventario";
import {
  COLTURA_SERRA_DEFAULT,
  GIORNI_PRODUZIONE_SERRA_PER_MESE,
  isColturaSerraValida,
  PRODUZIONE_SERRA_GIORNALIERA
} from "./colturaSerra";

export function isSerraOperativa(edificio: Edificio): boolean {
  return edificio.nome === "Serra" && edificio.stato === "Operativo";
}

export function getColturaItemIdSerra(edificio: Edificio): string | null {
  if (!isSerraOperativa(edificio)) return null;
  const id = edificio.colturaItemId ?? COLTURA_SERRA_DEFAULT;
  return isColturaSerraValida(id) ? id : null;
}

/** Quantità per itemId prodotte da tutte le Serre nel periodo indicato. */
export function calcolaProduzioneSerraPerPeriodo(
  edifici: Edificio[],
  giorni: number
): Map<string, number> {
  const out = new Map<string, number>();
  if (giorni <= 0) return out;

  for (const edificio of edifici) {
    const coltura = getColturaItemIdSerra(edificio);
    if (!coltura) continue;
    const qty = PRODUZIONE_SERRA_GIORNALIERA * giorni;
    out.set(coltura, (out.get(coltura) ?? 0) + qty);
  }
  return out;
}

export function calcolaProduzioneSerraMensile(edifici: Edificio[]): number {
  let tot = 0;
  for (const edificio of edifici) {
    if (getColturaItemIdSerra(edificio)) {
      tot += PRODUZIONE_SERRA_GIORNALIERA * GIORNI_PRODUZIONE_SERRA_PER_MESE;
    }
  }
  return tot;
}

export function applicaProduzioneSerraInventarioGiocatore(
  inventario: VoceInventario[],
  produzione: Map<string, number>
): VoceInventario[] {
  let next = inventario;
  for (const [itemId, quantità] of produzione) {
    if (quantità > 0) next = aggiungiCiboAInventarioGiocatore(next, itemId, quantità);
  }
  return next;
}
