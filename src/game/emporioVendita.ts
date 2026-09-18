import type { Abitante, Edificio } from "../types";
import {
  aggiungiMoneteInventarioAbitante,
  aggiungiOggettoInventarioAbitante,
  abitantePuòConsumareOggettoCibo,
  getMoneteInventarioAbitante,
  isOggettoCibo,
  OGGETTI_INVENTARIO,
  provaSpendiMoneteInventarioAbitante,
  type VoceInventario
} from "./inventario";
import { trovaEmporioOperativo, NOME_EMPORIO } from "./emporioLavoro";
import { LAVORO_RACCOGLITORE } from "./boscoRaccolta";
import { LAVORO_AGRICOLTORE } from "./produzioneSerra";
import { isGiocatore } from "./schiavituCommercio";
import { getAlimentazioneAbitante } from "./alimentazione";
import { PREZZO_CIBO_NEGOZIO } from "./economiaPrezzi";
import { haCiboCompatibileInInventario } from "./mensaPubblica";
import { abitanteHaInventarioPersonale } from "./casta";

export const PREZZO_VENDITA_ALIMENTO_EMPORIO = 1;
/** Prezzo per comprare 1 alimento dalle scorte Emporio (monete → cassa Impresa). */
export const PREZZO_ACQUISTO_ALIMENTO_EMPORIO = PREZZO_CIBO_NEGOZIO;
/** Scorte cibo iniziali dell’Emporio a inizio partita. */
export const EMPORIO_SCORTE_CIBO_INIZIALI = 24;
/** @deprecated Usa MAX_REGISTRAZIONI_SCAMBI da registrazioniScambi. */
export const MAX_REGISTRAZIONI_EMPORIO = 100;

/** @deprecated Usa RegistrazioneScambio da registrazioniScambi. */
export type RegistrazioneVenditaEmporio = {
  id: string;
  giorno: number;
  minutiDaMezzanotte: number;
  venditoreId: number;
  venditoreNome: string;
  mercanteId: number;
  mercanteNome: string;
  itemId: string;
  itemNome: string;
  itemEmoji: string;
  prezzoMonete: number;
  emporioId: number;
};

/** @deprecated */
export function formatRegistrazioneVenditaEmporio(r: RegistrazioneVenditaEmporio): string {
  return `${r.itemEmoji} ${r.venditoreNome} → ${r.mercanteNome}: ${r.itemNome} (−${r.prezzoMonete}💰)`;
}

/** @deprecated Usa appendRegistrazioneScambio. */
export function appendRegistrazioneVenditaEmporio(
  prev: RegistrazioneVenditaEmporio[] | undefined,
  voce: RegistrazioneVenditaEmporio
): RegistrazioneVenditaEmporio[] {
  const next = [...(prev ?? []), voce];
  if (next.length <= MAX_REGISTRAZIONI_EMPORIO) return next;
  return next.slice(next.length - MAX_REGISTRAZIONI_EMPORIO);
}

/** Scorte merce dell’Emporio (alimenti acquistati dai Raccoglitori). */
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
  return [...map.entries()]
    .map(([id, q]) => ({ itemId: id, quantità: q }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
}

export function contaUnitaCiboInventario(inventario?: VoceInventario[]): number {
  if (!inventario?.length) return 0;
  let tot = 0;
  for (const v of inventario) {
    if (!isOggettoCibo(v.itemId)) continue;
    tot += Math.max(0, v.quantità);
  }
  return tot;
}

/** Preferisce una voce con quantità ≥ 2, altrimenti qualsiasi alimento. */
export function scegliAlimentoDaVendere(inventario?: VoceInventario[]): string | null {
  if (!inventario?.length) return null;
  const cibi = inventario.filter((v) => isOggettoCibo(v.itemId) && v.quantità > 0);
  if (cibi.length === 0) return null;
  const surplus = cibi.find((v) => v.quantità >= 2);
  return (surplus ?? cibi[0])!.itemId;
}

export function produttoreHaEccedenzaCiboDaVendere(abitante: Abitante): boolean {
  if (isGiocatore(abitante)) return false;
  if (abitante.lavoro !== LAVORO_RACCOGLITORE && abitante.lavoro !== LAVORO_AGRICOLTORE) {
    return false;
  }
  return contaUnitaCiboInventario(abitante.inventario) >= 2;
}

/** @deprecated Usa produttoreHaEccedenzaCiboDaVendere. */
export function raccoglitoreHaEccedenzaCiboDaVendere(abitante: Abitante): boolean {
  return produttoreHaEccedenzaCiboDaVendere(abitante);
}

/** Mercanti assegnati all’Emporio con almeno 1 moneta. */
export function mercantiEmporioConMonete(
  emporio: Edificio,
  abitanti: Abitante[]
): Abitante[] {
  const ids = new Set(emporio.abitantiAssegnati ?? []);
  return abitanti
    .filter((a) => {
      if (!ids.has(a.id) || isGiocatore(a)) return false;
      if (a.lavoro !== "Mercante" && a.lavoro !== "Commerciante") return false;
      return getMoneteInventarioAbitante(a.inventario) >= PREZZO_VENDITA_ALIMENTO_EMPORIO;
    })
    .sort((a, b) => getMoneteInventarioAbitante(b.inventario) - getMoneteInventarioAbitante(a.inventario));
}

export function emporioPuòComprareAlimento(edifici: Edificio[], abitanti: Abitante[]): Edificio | undefined {
  const emporio = trovaEmporioOperativo(edifici);
  if (!emporio) return undefined;
  if (mercantiEmporioConMonete(emporio, abitanti).length === 0) return undefined;
  return emporio;
}

export function raccoglitorePuòVendereAllEmporio(
  abitante: Abitante,
  edifici: Edificio[],
  abitanti: Abitante[]
): boolean {
  if (!produttoreHaEccedenzaCiboDaVendere(abitante)) return false;
  if (!scegliAlimentoDaVendere(abitante.inventario)) return false;
  return emporioPuòComprareAlimento(edifici, abitanti) != null;
}

export function rimuoviUnitaOggettoInventarioAbitante(
  abitante: Abitante,
  itemId: string,
  quantità = 1
): Abitante | null {
  if (quantità <= 0) return abitante;
  const inv = [...(abitante.inventario ?? [])];
  const idx = inv.findIndex((v) => v.itemId === itemId && v.quantità > 0);
  if (idx < 0) return null;
  const voce = inv[idx]!;
  if (voce.quantità < quantità) return null;
  const nextQ = voce.quantità - quantità;
  if (nextQ <= 0) inv.splice(idx, 1);
  else inv[idx] = { ...voce, quantità: nextQ };
  return { ...abitante, inventario: inv, crediti: 0 };
}

/**
 * Raccoglitore o Agricoltore vende 1 alimento all’Emporio: −1 cibo venditore, +1 scorte Emporio,
 * −1 moneta Mercante, +1 moneta venditore.
 */
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
  const emporio = venditore ? emporioPuòComprareAlimento(edifici, abitanti) : undefined;
  if (!venditore || !emporio || !produttoreHaEccedenzaCiboDaVendere(venditore)) {
    return { ok: false, abitanti, inventarioEmporio: normalizzaInventarioEmporio(inventarioEmporio) };
  }
  const itemId = scegliAlimentoDaVendere(venditore.inventario);
  const mercanti = mercantiEmporioConMonete(emporio, abitanti);
  const mercante = mercanti[0];
  if (!itemId || !mercante) {
    return { ok: false, abitanti, inventarioEmporio: normalizzaInventarioEmporio(inventarioEmporio) };
  }

  const senzaCibo = rimuoviUnitaOggettoInventarioAbitante(venditore, itemId, 1);
  if (!senzaCibo) {
    return { ok: false, abitanti, inventarioEmporio: normalizzaInventarioEmporio(inventarioEmporio) };
  }
  const mercantePagato = provaSpendiMoneteInventarioAbitante(mercante, PREZZO_VENDITA_ALIMENTO_EMPORIO);
  if (!mercantePagato) {
    return { ok: false, abitanti, inventarioEmporio: normalizzaInventarioEmporio(inventarioEmporio) };
  }
  const venditorePagato = aggiungiMoneteInventarioAbitante(senzaCibo, PREZZO_VENDITA_ALIMENTO_EMPORIO);

  const abitantiNext = abitanti.map((a) => {
    if (a.id === venditorePagato.id) return venditorePagato;
    if (a.id === mercantePagato.id) return mercantePagato;
    return a;
  });
  const invNext = aggiungiAlimentoInventarioEmporio(inventarioEmporio, itemId, 1);
  return {
    ok: true,
    abitanti: abitantiNext,
    inventarioEmporio: invNext,
    itemId,
    mercanteId: mercante.id,
    emporioId: emporio.id
  };
}

function scegliAlimentoDaEmporioPerDieta(
  inventario: VoceInventario[] | undefined,
  alimentazione: string
): string | null {
  const cibi = normalizzaInventarioEmporio(inventario).filter(
    (v) => v.quantità > 0 && abitantePuòConsumareOggettoCibo(alimentazione, v.itemId)
  );
  return cibi[0]?.itemId ?? null;
}

export function rimuoviAlimentoInventarioEmporio(
  inventario: VoceInventario[] | undefined,
  itemId: string,
  quantità = 1
): VoceInventario[] | null {
  if (quantità <= 0) return normalizzaInventarioEmporio(inventario);
  const inv = normalizzaInventarioEmporio(inventario);
  const idx = inv.findIndex((v) => v.itemId === itemId && v.quantità >= quantità);
  if (idx < 0) return null;
  const next = inv
    .map((v, i) => (i === idx ? { ...v, quantità: v.quantità - quantità } : v))
    .filter((v) => v.quantità > 0);
  return next;
}

/** True se l’abitante può comprare un pasto dalle scorte Emporio. */
export function abitantePuòComprarePastoAllEmporio(
  abitante: Abitante,
  edifici: Edificio[],
  inventarioEmporioByEdificioId: Record<number, VoceInventario[]>
): boolean {
  if (!abitanteHaInventarioPersonale(abitante) || isGiocatore(abitante)) return false;
  if (haCiboCompatibileInInventario(abitante.inventario, getAlimentazioneAbitante(abitante))) {
    return false;
  }
  if (getMoneteInventarioAbitante(abitante.inventario) < PREZZO_ACQUISTO_ALIMENTO_EMPORIO) {
    return false;
  }
  const emporio = trovaEmporioOperativo(edifici);
  if (!emporio) return false;
  const itemId = scegliAlimentoDaEmporioPerDieta(
    inventarioEmporioByEdificioId[emporio.id],
    getAlimentazioneAbitante(abitante)
  );
  return itemId != null;
}

/**
 * Compra 1 alimento dalle scorte Emporio: −monete acquirente, +cassa Emporio, −1 scorta, +1 inventario.
 */
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
} {
  const invMap = { ...inventarioEmporioByEdificioId };
  if (!abitantePuòComprarePastoAllEmporio(abitante, edifici, invMap)) {
    return { ok: false, abitante, edifici, inventarioEmporioByEdificioId: invMap, itemId: null };
  }
  const emporio = trovaEmporioOperativo(edifici)!;
  const dieta = getAlimentazioneAbitante(abitante);
  const itemId = scegliAlimentoDaEmporioPerDieta(invMap[emporio.id], dieta);
  if (!itemId) {
    return { ok: false, abitante, edifici, inventarioEmporioByEdificioId: invMap, itemId: null };
  }
  const dopoSpesa = provaSpendiMoneteInventarioAbitante(abitante, PREZZO_ACQUISTO_ALIMENTO_EMPORIO);
  if (!dopoSpesa) {
    return { ok: false, abitante, edifici, inventarioEmporioByEdificioId: invMap, itemId: null };
  }
  const invNext = rimuoviAlimentoInventarioEmporio(invMap[emporio.id], itemId, 1);
  if (!invNext) {
    return { ok: false, abitante, edifici, inventarioEmporioByEdificioId: invMap, itemId: null };
  }
  invMap[emporio.id] = invNext;
  const abitanteNext = aggiungiOggettoInventarioAbitante(dopoSpesa, itemId, 1);
  const edificiNext = edifici.map((e) =>
    e.id === emporio.id
      ? {
          ...e,
          cassaMonete: Math.max(0, Math.floor(e.cassaMonete ?? 0)) + PREZZO_ACQUISTO_ALIMENTO_EMPORIO
        }
      : e
  );
  return {
    ok: true,
    abitante: abitanteNext,
    edifici: edificiNext,
    inventarioEmporioByEdificioId: invMap,
    itemId
  };
}

/** Inventario Emporio iniziale (scorte cibo per chi non produce). */
export function creaInventarioEmporioIniziale(colturaItemId?: string): VoceInventario[] {
  const id =
    colturaItemId && isOggettoCibo(colturaItemId) ? colturaItemId : "mela";
  return [{ itemId: id, quantità: EMPORIO_SCORTE_CIBO_INIZIALI }];
}

export { NOME_EMPORIO };
