import type { Abitante } from "../types";
import { getAlimentazioneAbitante } from "./alimentazione";
import { abitanteHaInventarioPersonale } from "./casta";
import {
  MONETE_INVENTARIO_SEED_DEFAULT,
  moneteDaCreditiLegacy,
  moneteInventarioSeedCasuali
} from "./economiaPrezzi";
import { COLTURE_SERRA } from "./colturaSerra";

export type CategoriaInventario = "Valuta" | "Cibo";

export type TagCibo = "carne" | "latticini" | "uova";

export type OggettoInventarioDef = {
  id: string;
  nome: string;
  emoji: string;
  categoria: CategoriaInventario;
  /** Per oggetti Cibo: restrizioni alimentari (Vegetariano / Vegano). */
  tagCibo?: TagCibo[];
};

export const CATEGORIA_CIBO: CategoriaInventario = "Cibo";

const OGGETTI_CIBO_ANIMALE: Record<string, OggettoInventarioDef> = {
  bistecca: { id: "bistecca", nome: "Bistecca", emoji: "🥩", categoria: CATEGORIA_CIBO, tagCibo: ["carne"] },
  latte: { id: "latte", nome: "Latte", emoji: "🥛", categoria: CATEGORIA_CIBO, tagCibo: ["latticini"] },
  uovo: { id: "uovo", nome: "Uovo", emoji: "🥚", categoria: CATEGORIA_CIBO, tagCibo: ["uova"] }
};

const OGGETTI_CIBO_VEGETALE: Record<string, OggettoInventarioDef> = Object.fromEntries(
  COLTURE_SERRA.map((c) => [c.id, { id: c.id, nome: c.nome, emoji: c.emoji, categoria: CATEGORIA_CIBO }])
);

export const OGGETTI_INVENTARIO: Record<string, OggettoInventarioDef> = {
  monete: { id: "monete", nome: "Monete", emoji: "💰", categoria: "Valuta" },
  ...OGGETTI_CIBO_VEGETALE,
  ...OGGETTI_CIBO_ANIMALE
};

/** Voci cibo condivise (giocatore, mensa, pasti). */
export const VOCI_CIBO_IDS = [
  ...COLTURE_SERRA.map((c) => c.id),
  "bistecca",
  "latte",
  "uovo"
] as const;

export type VoceInventario = { itemId: string; quantità: number };

const INVENTARIO_INIZIALE: VoceInventario[] = [
  { itemId: "monete", quantità: MONETE_INVENTARIO_SEED_DEFAULT },
  { itemId: "mela", quantità: 5 },
  { itemId: "bistecca", quantità: 5 },
  { itemId: "latte", quantità: 5 },
  { itemId: "uovo", quantità: 5 }
];

/** Inventario cibo del giocatore (colonia): solo oggetti Cibo, senza monete. */
const INVENTARIO_GIOCATORE_INIZIALE: VoceInventario[] = [
  { itemId: "mela", quantità: 20 },
  { itemId: "bistecca", quantità: 20 },
  { itemId: "latte", quantità: 20 },
  { itemId: "uovo", quantità: 20 }
];

/** Inventario di partenza per ogni abitante. */
export function creaInventarioIniziale(moneteQuantità?: number): VoceInventario[] {
  const monete = Math.max(
    0,
    Math.floor(moneteQuantità ?? MONETE_INVENTARIO_SEED_DEFAULT)
  );
  return INVENTARIO_INIZIALE.map((v) =>
    v.itemId === "monete" ? { ...v, quantità: monete } : { ...v }
  );
}

/** Inventario cibo iniziale del giocatore. */
export function creaInventarioGiocatoreIniziale(): VoceInventario[] {
  return INVENTARIO_GIOCATORE_INIZIALE.map((v) => ({ ...v }));
}

export function normalizzaInventarioGiocatore(inventario?: VoceInventario[]): VoceInventario[] {
  const map = new Map<string, number>();
  for (const v of inventario ?? []) {
    if (!OGGETTI_INVENTARIO[v.itemId] || !isOggettoCibo(v.itemId)) continue;
    map.set(v.itemId, Math.max(0, v.quantità));
  }
  for (const base of INVENTARIO_GIOCATORE_INIZIALE) {
    if (!map.has(base.itemId)) map.set(base.itemId, base.quantità);
  }
  return [...map.entries()].map(([itemId, quantità]) => ({ itemId, quantità }));
}

export function aggiungiCiboAInventarioGiocatore(
  inventario: VoceInventario[],
  itemId: string,
  quantità: number
): VoceInventario[] {
  if (quantità <= 0 || !isOggettoCibo(itemId)) return inventario;
  const norm = normalizzaInventarioGiocatore(inventario);
  const idx = norm.findIndex((v) => v.itemId === itemId);
  if (idx >= 0) {
    return norm.map((v, i) => (i === idx ? { ...v, quantità: v.quantità + quantità } : v));
  }
  return [...norm, { itemId, quantità }];
}

export function isOggettoValuta(itemId: string): boolean {
  return OGGETTI_INVENTARIO[itemId]?.categoria === "Valuta";
}

export function aggiungiMoneteInventarioAbitante(abitante: Abitante, quantità: number): Abitante {
  if (quantità <= 0 || !abitanteHaInventarioPersonale(abitante)) return abitante;
  const inv = normalizzaInventarioAbitante(abitante.inventario);
  const next = inv.map((v) =>
    v.itemId === "monete" ? { ...v, quantità: v.quantità + quantità } : v
  );
  return { ...abitante, inventario: next, crediti: 0 };
}

export function setMoneteInventarioAbitante(abitante: Abitante, quantità: number): Abitante {
  if (!abitanteHaInventarioPersonale(abitante)) {
    return { ...abitante, inventario: undefined, crediti: 0 };
  }
  const inv = normalizzaInventarioAbitante(abitante.inventario);
  const q = Math.max(0, Math.floor(quantità));
  const next = inv.map((v) => (v.itemId === "monete" ? { ...v, quantità: q } : v));
  return { ...abitante, inventario: next, crediti: 0 };
}

/** Sottrae monete; `null` se saldo insufficiente o senza inventario. */
export function provaSpendiMoneteInventarioAbitante(
  abitante: Abitante,
  quantità: number
): Abitante | null {
  if (quantità <= 0) return abitante;
  if (!abitanteHaInventarioPersonale(abitante)) return null;
  const monete = getMoneteInventarioAbitante(abitante.inventario);
  if (monete < quantità) return null;
  return setMoneteInventarioAbitante(abitante, monete - quantità);
}

export function getMoneteInventarioAbitante(inventario?: VoceInventario[]): number {
  if (!inventario?.length) return 0;
  return normalizzaInventarioAbitante(inventario).find((v) => v.itemId === "monete")?.quantità ?? 0;
}

export function getTotaleOggettiInventarioGiocatore(inventario: VoceInventario[] | undefined): number {
  return normalizzaInventarioGiocatore(inventario).reduce((s, v) => s + v.quantità, 0);
}

/** Inventario cibo della Mensa Pubblica (parte vuoto). */
export function creaInventarioMensaVuoto(): VoceInventario[] {
  return VOCI_CIBO_IDS.map((id) => ({ itemId: id, quantità: 0 }));
}

export function normalizzaInventarioMensa(inventario?: VoceInventario[]): VoceInventario[] {
  const map = new Map<string, number>();
  for (const v of inventario ?? []) {
    if (!OGGETTI_INVENTARIO[v.itemId] || !isOggettoCibo(v.itemId)) continue;
    map.set(v.itemId, Math.max(0, v.quantità));
  }
  return VOCI_CIBO_IDS.map((id) => ({ itemId: id, quantità: map.get(id) ?? 0 }));
}

export function getTotaleOggettiInventarioMensa(inventario: VoceInventario[] | undefined): number {
  return normalizzaInventarioMensa(inventario).reduce((s, v) => s + v.quantità, 0);
}

/** Sposta cibo da un inventario normalizzato a un altro; null se quantità insufficiente. */
export function trasferisciCiboTraInventari(
  da: VoceInventario[],
  a: VoceInventario[],
  itemId: string,
  quantità: number,
  normalizzaDa: (inv?: VoceInventario[]) => VoceInventario[],
  normalizzaA: (inv?: VoceInventario[]) => VoceInventario[]
): { da: VoceInventario[]; a: VoceInventario[] } | null {
  if (quantità <= 0 || !isOggettoCibo(itemId)) return null;
  const src = normalizzaDa(da);
  const dst = normalizzaA(a);
  const voce = src.find((v) => v.itemId === itemId);
  if (!voce || voce.quantità < quantità) return null;
  return {
    da: src.map((v) => (v.itemId === itemId ? { ...v, quantità: v.quantità - quantità } : v)),
    a: dst.map((v) => (v.itemId === itemId ? { ...v, quantità: v.quantità + quantità } : v))
  };
}

export function isOggettoCibo(itemId: string): boolean {
  return OGGETTI_INVENTARIO[itemId]?.categoria === CATEGORIA_CIBO;
}

export function getOggettoInventario(itemId: string): OggettoInventarioDef | undefined {
  return OGGETTI_INVENTARIO[itemId];
}

/** True se l'abitante può consumare questo oggetto Cibo in base all'alimentazione. */
export function abitantePuòConsumareOggettoCibo(alimentazione: string, itemId: string): boolean {
  const def = OGGETTI_INVENTARIO[itemId];
  if (!def || def.categoria !== CATEGORIA_CIBO) return false;
  const tags = def.tagCibo ?? [];
  if (alimentazione === "Vegetariano") return !tags.includes("carne");
  if (alimentazione === "Vegano") return tags.length === 0;
  return true;
}

/** Unisce voci note al catalogo; aggiunge voci mancanti dall'inventario iniziale. */
export function normalizzaInventarioAbitante(inventario?: VoceInventario[]): VoceInventario[] {
  const map = new Map<string, number>();
  for (const v of inventario ?? []) {
    if (!OGGETTI_INVENTARIO[v.itemId]) continue;
    map.set(v.itemId, Math.max(0, v.quantità));
  }
  for (const base of INVENTARIO_INIZIALE) {
    if (!map.has(base.itemId)) map.set(base.itemId, base.quantità);
  }
  return INVENTARIO_INIZIALE.map((b) => ({
    itemId: b.itemId,
    quantità: map.get(b.itemId) ?? 0
  }));
}

export function abitanteConInventarioIniziale<T extends Abitante>(abitante: T): T {
  if (!abitanteHaInventarioPersonale(abitante)) {
    return { ...abitante, inventario: undefined, ultimoGiornoCiboConsumato: undefined };
  }
  return {
    ...abitante,
    inventario: creaInventarioIniziale(moneteInventarioSeedCasuali()),
    ultimoGiornoCiboConsumato: undefined
  };
}

/** Rimuove l'inventario dagli schiavi/servi e normalizza gli altri.
 *  Migra eventuali `crediti` legacy nelle monete in inventario. */
export function normalizzaAbitanteInventario(abitante: Abitante): Abitante {
  const alimentazione = getAlimentazioneAbitante(abitante);
  const personalità = abitante.personalità === "Vegetariano" || abitante.personalità === "Vegano"
    ? "Tiepido"
    : abitante.personalità;
  abitante = { ...abitante, alimentazione, personalità };
  const legacyCrediti = Math.max(0, Math.floor(abitante.crediti ?? 0));
  if (!abitanteHaInventarioPersonale(abitante)) {
    const { inventario: _inv, ...rest } = abitante;
    return { ...rest, inventario: undefined, crediti: 0 };
  }
  let inv = normalizzaInventarioAbitante(abitante.inventario);
  if (legacyCrediti > 0) {
    const convertite = moneteDaCreditiLegacy(legacyCrediti);
    const attuali = inv.find((v) => v.itemId === "monete")?.quantità ?? 0;
    const target = Math.max(attuali, convertite);
    inv = inv.map((v) => (v.itemId === "monete" ? { ...v, quantità: target } : v));
  }
  return { ...abitante, inventario: inv, crediti: 0 };
}

/** Consuma 1 unità del primo oggetto Cibo disponibile e compatibile con la dieta; null se nessuno. */
export function consumaUnOggettoCibo(
  inventario: VoceInventario[],
  personalità?: string
): VoceInventario[] | null {
  const inv = normalizzaInventarioAbitante(inventario);
  const idx = inv.findIndex(
    (v) =>
      isOggettoCibo(v.itemId) &&
      v.quantità > 0 &&
      abitantePuòConsumareOggettoCibo(personalità ?? "", v.itemId)
  );
  if (idx < 0) return null;
  const next = inv.map((v, i) => (i === idx ? { ...v, quantità: v.quantità - 1 } : v));
  return next;
}

/** Trasferisce monete tra due abitanti con inventario; null se saldo insufficiente. */
export function trasferisciMoneteTraAbitanti(
  da: Abitante,
  a: Abitante,
  quantità: number
): { da: Abitante; a: Abitante } | null {
  const q = Math.floor(quantità);
  if (q <= 0) return { da, a };
  if (!abitanteHaInventarioPersonale(da) || !abitanteHaInventarioPersonale(a)) return null;
  const dopoSpesa = provaSpendiMoneteInventarioAbitante(da, q);
  if (!dopoSpesa) return null;
  return { da: dopoSpesa, a: aggiungiMoneteInventarioAbitante(a, q) };
}

/**
 * Preleva 1 cibo dalla vittima compatibile con la dieta del ladro.
 * Restituisce anche l'`itemId` tolto.
 */
export function prelevaCiboCompatibileDaAbitante(
  vittima: Abitante,
  personalitàLadro: string
): { vittima: Abitante; itemId: string } | null {
  if (!abitanteHaInventarioPersonale(vittima) || !vittima.inventario?.length) return null;
  const inv = normalizzaInventarioAbitante(vittima.inventario);
  const idx = inv.findIndex(
    (v) =>
      isOggettoCibo(v.itemId) &&
      v.quantità > 0 &&
      abitantePuòConsumareOggettoCibo(personalitàLadro, v.itemId)
  );
  if (idx < 0) return null;
  const itemId = inv[idx]!.itemId;
  const next = inv.map((v, i) => (i === idx ? { ...v, quantità: v.quantità - 1 } : v));
  return { vittima: { ...vittima, inventario: next }, itemId };
}

export type VoceInventarioDisplay = {
  def: OggettoInventarioDef;
  quantità: number;
};

export function getVociInventarioPerCategoria(
  inventario: VoceInventario[] | undefined,
  categoria: CategoriaInventario
): VoceInventarioDisplay[] {
  if (!inventario?.length) return [];
  return normalizzaInventarioAbitante(inventario)
    .filter((v) => OGGETTI_INVENTARIO[v.itemId]?.categoria === categoria)
    .map((v) => ({
      def: OGGETTI_INVENTARIO[v.itemId]!,
      quantità: v.quantità
    }));
}
