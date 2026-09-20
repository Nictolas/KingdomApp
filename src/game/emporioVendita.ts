import type { Abitante, Edificio } from "../types";
import {
  aggiungiMoneteInventarioAbitante,
  abitantePuòConsumareOggettoCibo,
  getMoneteInventarioAbitante,
  isOggettoCibo,
  normalizzaInventarioAbitante,
  OGGETTI_INVENTARIO,
  provaSpendiMoneteInventarioAbitante,
  type VoceInventario
} from "./inventario";
import { trovaEmporioOperativo, NOME_EMPORIO } from "./emporioLavoro";
import { isGiocatore } from "./schiavituCommercio";
import { PREZZO_CIBO_NEGOZIO } from "./economiaPrezzi";
import { haCiboCompatibileInInventario } from "./mensaPubblica";
import { abitanteHaInventarioPersonale } from "./casta";

export const PREZZO_VENDITA_ALIMENTO_EMPORIO = 1;
export const PREZZO_ACQUISTO_ALIMENTO_EMPORIO = PREZZO_CIBO_NEGOZIO;
export const EMPORIO_SCORTE_CIBO_INIZIALI = 24;

export type EmporioScambio = {
  tipo: "produttore-vende" | "cliente-compra";
  emporioId: number;
  itemId: string;
  prezzoMonete: number;
  daId: number | null;
  daNome: string;
  aId: number | null;
  aNome: string;
};

export function normalizzaInventarioEmporio(inventario?: VoceInventario[]): VoceInventario[] {
  const map = new Map<string, number>();
  for (const v of inventario ?? []) {
    if (!OGGETTI_INVENTARIO[v.itemId] || !isOggettoCibo(v.itemId)) continue;
    const q = Math.max(0, Math.floor(v.quantità));
    if (q <= 0) continue;
    map.set(v.itemId, (map.get(v.itemId) ?? 0) + q);
  }
  return [...map.entries()]
    .map(([itemId, quantità]) => ({ itemId, quantità }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
}

export function aggiungiAlimentoInventarioEmporio(
  inventario: VoceInventario[] | undefined,
  itemId: string,
  quantità = 1
): VoceInventario[] {
  if (quantità <= 0 || !isOggettoCibo(itemId)) return normalizzaInventarioEmporio(inventario);
  const map = new Map(normalizzaInventarioEmporio(inventario).map((v) => [v.itemId, v.quantità]));
  map.set(itemId, (map.get(itemId) ?? 0) + Math.floor(quantità));
  return [...map.entries()].map(([id, q]) => ({ itemId: id, quantità: q })).sort((a, b) => a.itemId.localeCompare(b.itemId));
}

export function contaUnitaCiboInventario(inventario?: VoceInventario[]): number {
  return (inventario ?? []).reduce((tot, v) => tot + (isOggettoCibo(v.itemId) ? Math.max(0, v.quantità) : 0), 0);
}

export function scegliAlimentoDaVendere(inventario?: VoceInventario[]): string | null {
  const cibi = (inventario ?? []).filter((v) => isOggettoCibo(v.itemId) && v.quantità > 0);
  if (cibi.length === 0) return null;
  return (cibi.find((v) => v.quantità >= 2) ?? cibi[0])!.itemId;
}

export function produttoreHaEccedenzaCiboDaVendere(abitante: Abitante): boolean {
  if (isGiocatore(abitante)) return false;
  if (abitante.lavoro !== "Raccoglitore" && abitante.lavoro !== "Agricoltore") return false;
  return contaUnitaCiboInventario(abitante.inventario) >= 2;
}

export function mercantiEmporioConMonete(emporio: Edificio, abitanti: Abitante[]): Abitante[] {
  const ids = new Set(emporio.abitantiAssegnati ?? []);
  return abitanti
    .filter((a) =>
      ids.has(a.id) &&
      !isGiocatore(a) &&
      (a.lavoro === "Mercante" || a.lavoro === "Commerciante") &&
      getMoneteInventarioAbitante(a.inventario) >= PREZZO_VENDITA_ALIMENTO_EMPORIO
    )
    .sort((a, b) => getMoneteInventarioAbitante(b.inventario) - getMoneteInventarioAbitante(a.inventario));
}

export function rimuoviUnitaOggettoInventarioAbitante(
  abitante: Abitante,
  itemId: string,
  quantità = 1
): Abitante | null {
  if (quantità <= 0) return abitante;
  const inv = [...(abitante.inventario ?? [])];
  const idx = inv.findIndex((v) => v.itemId === itemId && v.quantità >= quantità);
  if (idx < 0) return null;
  const voce = inv[idx]!;
  const q = voce.quantità - quantità;
  if (q <= 0) inv.splice(idx, 1);
  else inv[idx] = { ...voce, quantità: q };
  return { ...abitante, inventario: inv, crediti: 0 };
}

export function eseguiVenditaAlimentoAllEmporio(
  abitanti: Abitante[],
  edifici: Edificio[],
  venditoreId: number,
  inventarioEmporio: VoceInventario[] | undefined
): {
  ok: boolean;
  abitanti: Abitante[];
  inventarioEmporio: VoceInventario[];
  itemId?: string;
  mercanteId?: number;
  emporioId?: number;
} {
  const venditore = abitanti.find((a) => a.id === venditoreId);
  const emporio = trovaEmporioOperativo(edifici);
  if (!venditore || !emporio || !produttoreHaEccedenzaCiboDaVendere(venditore)) {
    return { ok: false, abitanti, inventarioEmporio: normalizzaInventarioEmporio(inventarioEmporio) };
  }
  const itemId = scegliAlimentoDaVendere(venditore.inventario);
  const mercante = mercantiEmporioConMonete(emporio, abitanti)[0];
  if (!itemId || !mercante) {
    return { ok: false, abitanti, inventarioEmporio: normalizzaInventarioEmporio(inventarioEmporio) };
  }

  const senzaCibo = rimuoviUnitaOggettoInventarioAbitante(venditore, itemId, 1);
  const mercanteDopo = provaSpendiMoneteInventarioAbitante(mercante, PREZZO_VENDITA_ALIMENTO_EMPORIO);
  if (!senzaCibo || !mercanteDopo) {
    return { ok: false, abitanti, inventarioEmporio: normalizzaInventarioEmporio(inventarioEmporio) };
  }
  const venditoreDopo = aggiungiMoneteInventarioAbitante(senzaCibo, PREZZO_VENDITA_ALIMENTO_EMPORIO);
  return {
    ok: true,
    abitanti: abitanti.map((a) => a.id === venditoreDopo.id ? venditoreDopo : a.id === mercanteDopo.id ? mercanteDopo : a),
    inventarioEmporio: aggiungiAlimentoInventarioEmporio(inventarioEmporio, itemId, 1),
    itemId,
    mercanteId: mercante.id,
    emporioId: emporio.id
  };
}

export function applicaVenditeEccedenzeEmporioPerPeriodo(
  abitanti: Abitante[],
  edifici: Edificio[],
  inventarioEmporioByEdificioId: Record<number, VoceInventario[]>,
  giorni: number
): {
  abitanti: Abitante[];
  inventarioEmporioByEdificioId: Record<number, VoceInventario[]>;
  vendite: number;
  scambi: EmporioScambio[];
} {
  const emporio = trovaEmporioOperativo(edifici);
  if (!emporio || giorni <= 0) {
    return { abitanti, inventarioEmporioByEdificioId, vendite: 0, scambi: [] };
  }

  let nextAbitanti = abitanti;
  let nextInventari = { ...inventarioEmporioByEdificioId };
  let vendite = 0;
  const scambi: EmporioScambio[] = [];
  for (let g = 0; g < giorni; g++) {
    for (const produttore of [...nextAbitanti]) {
      if (!produttoreHaEccedenzaCiboDaVendere(produttore)) continue;
      const result = eseguiVenditaAlimentoAllEmporio(
        nextAbitanti,
        edifici,
        produttore.id,
        nextInventari[emporio.id]
      );
      if (!result.ok) continue;
      const venditoreDopo = result.abitanti.find((a) => a.id === produttore.id);
      const mercanteDopo = result.abitanti.find((a) => a.id === result.mercanteId);
      nextAbitanti = result.abitanti;
      nextInventari = { ...nextInventari, [emporio.id]: result.inventarioEmporio };
      vendite++;
      scambi.push({
        tipo: "produttore-vende",
        emporioId: emporio.id,
        itemId: result.itemId!,
        prezzoMonete: PREZZO_VENDITA_ALIMENTO_EMPORIO,
        daId: result.mercanteId ?? null,
        daNome: mercanteDopo?.nome ?? "Mercante",
        aId: produttore.id,
        aNome: venditoreDopo?.nome ?? produttore.nome
      });
    }
  }
  return { abitanti: nextAbitanti, inventarioEmporioByEdificioId: nextInventari, vendite, scambi };
}

function scegliAlimentoDaEmporioPerDieta(
  inventario: VoceInventario[] | undefined,
  personalità: string
): string | null {
  return normalizzaInventarioEmporio(inventario)
    .find((v) => v.quantità > 0 && abitantePuòConsumareOggettoCibo(personalità, v.itemId))?.itemId ?? null;
}

export function rimuoviAlimentoInventarioEmporio(
  inventario: VoceInventario[] | undefined,
  itemId: string,
  quantità = 1
): VoceInventario[] | null {
  const inv = normalizzaInventarioEmporio(inventario);
  const idx = inv.findIndex((v) => v.itemId === itemId && v.quantità >= quantità);
  if (idx < 0) return null;
  return inv.map((v, i) => i === idx ? { ...v, quantità: v.quantità - quantità } : v).filter((v) => v.quantità > 0);
}

function aggiungiOggettoInventarioAbitante(abitante: Abitante, itemId: string): Abitante {
  if (!abitanteHaInventarioPersonale(abitante)) return abitante;
  const inv = normalizzaInventarioAbitante(abitante.inventario);
  const found = inv.find((v) => v.itemId === itemId);
  const next = found
    ? inv.map((v) => v.itemId === itemId ? { ...v, quantità: v.quantità + 1 } : v)
    : [...inv, { itemId, quantità: 1 }];
  return { ...abitante, inventario: next };
}

export function abitantePuòComprarePastoAllEmporio(
  abitante: Abitante,
  edifici: Edificio[],
  inventarioEmporioByEdificioId: Record<number, VoceInventario[]>
): boolean {
  if (!abitanteHaInventarioPersonale(abitante) || isGiocatore(abitante)) return false;
  if (haCiboCompatibileInInventario(abitante.inventario, abitante.personalità)) return false;
  if (getMoneteInventarioAbitante(abitante.inventario) < PREZZO_ACQUISTO_ALIMENTO_EMPORIO) return false;
  const emporio = trovaEmporioOperativo(edifici);
  return !!emporio && scegliAlimentoDaEmporioPerDieta(inventarioEmporioByEdificioId[emporio.id], abitante.personalità) != null;
}

export function eseguiAcquistoPastoDaEmporio(
  abitante: Abitante,
  edifici: Edificio[],
  inventarioEmporioByEdificioId: Record<number, VoceInventario[]>
): {
  ok: boolean;
  abitante: Abitante;
  edifici: Edificio[];
  inventarioEmporioByEdificioId: Record<number, VoceInventario[]>;
  itemId: string | null;
  emporioId: number | null;
  scambio: EmporioScambio | null;
} {
  const invMap = { ...inventarioEmporioByEdificioId };
  if (!abitantePuòComprarePastoAllEmporio(abitante, edifici, invMap)) {
    return { ok: false, abitante, edifici, inventarioEmporioByEdificioId: invMap, itemId: null, emporioId: null, scambio: null };
  }
  const emporio = trovaEmporioOperativo(edifici)!;
  const itemId = scegliAlimentoDaEmporioPerDieta(invMap[emporio.id], abitante.personalità);
  if (!itemId) return { ok: false, abitante, edifici, inventarioEmporioByEdificioId: invMap, itemId: null, emporioId: emporio.id, scambio: null };
  const dopoSpesa = provaSpendiMoneteInventarioAbitante(abitante, PREZZO_ACQUISTO_ALIMENTO_EMPORIO);
  const invNext = rimuoviAlimentoInventarioEmporio(invMap[emporio.id], itemId, 1);
  if (!dopoSpesa || !invNext) {
    return { ok: false, abitante, edifici, inventarioEmporioByEdificioId: invMap, itemId: null, emporioId: emporio.id, scambio: null };
  }
  invMap[emporio.id] = invNext;
  return {
    ok: true,
    abitante: aggiungiOggettoInventarioAbitante(dopoSpesa, itemId),
    edifici: edifici.map((e) => e.id === emporio.id ? {
      ...e,
      cassaMonete: Math.max(0, Math.floor(e.cassaMonete ?? 0)) + PREZZO_ACQUISTO_ALIMENTO_EMPORIO,
      fatturatoMeseMonete: Math.max(0, Math.floor(e.fatturatoMeseMonete ?? 0)) + PREZZO_ACQUISTO_ALIMENTO_EMPORIO
    } : e),
    inventarioEmporioByEdificioId: invMap,
    itemId,
    emporioId: emporio.id,
    scambio: {
      tipo: "cliente-compra",
      emporioId: emporio.id,
      itemId,
      prezzoMonete: PREZZO_ACQUISTO_ALIMENTO_EMPORIO,
      daId: abitante.id,
      daNome: abitante.nome,
      aId: null,
      aNome: "Emporio"
    }
  };
}

export function creaInventarioEmporioIniziale(colturaItemId?: string): VoceInventario[] {
  const id = colturaItemId && isOggettoCibo(colturaItemId) ? colturaItemId : "mela";
  return [{ itemId: id, quantità: EMPORIO_SCORTE_CIBO_INIZIALI }];
}

export { NOME_EMPORIO };
