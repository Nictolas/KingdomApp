import type { Abitante } from "../types";

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

export const OGGETTI_INVENTARIO: Record<string, OggettoInventarioDef> = {
  monete: { id: "monete", nome: "Monete", emoji: "💰", categoria: "Valuta" },
  mela: { id: "mela", nome: "Mela", emoji: "🍎", categoria: CATEGORIA_CIBO },
  bistecca: { id: "bistecca", nome: "Bistecca", emoji: "🥩", categoria: CATEGORIA_CIBO, tagCibo: ["carne"] },
  latte: { id: "latte", nome: "Latte", emoji: "🥛", categoria: CATEGORIA_CIBO, tagCibo: ["latticini"] },
  uovo: { id: "uovo", nome: "Uovo", emoji: "🥚", categoria: CATEGORIA_CIBO, tagCibo: ["uova"] }
};

export type VoceInventario = { itemId: string; quantità: number };

const INVENTARIO_INIZIALE: VoceInventario[] = [
  { itemId: "monete", quantità: 10 },
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
export function creaInventarioIniziale(): VoceInventario[] {
  return INVENTARIO_INIZIALE.map((v) => ({ ...v }));
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
  return INVENTARIO_GIOCATORE_INIZIALE.map((b) => ({
    itemId: b.itemId,
    quantità: map.get(b.itemId) ?? 0
  }));
}

export function getTotaleOggettiInventarioGiocatore(inventario: VoceInventario[] | undefined): number {
  return normalizzaInventarioGiocatore(inventario).reduce((s, v) => s + v.quantità, 0);
}

export function isOggettoCibo(itemId: string): boolean {
  return OGGETTI_INVENTARIO[itemId]?.categoria === CATEGORIA_CIBO;
}

export function getOggettoInventario(itemId: string): OggettoInventarioDef | undefined {
  return OGGETTI_INVENTARIO[itemId];
}

/** True se l'abitante può consumare questo oggetto Cibo in base alla personalità. */
export function abitantePuòConsumareOggettoCibo(personalità: string, itemId: string): boolean {
  const def = OGGETTI_INVENTARIO[itemId];
  if (!def || def.categoria !== CATEGORIA_CIBO) return false;
  const tags = def.tagCibo ?? [];
  if (personalità === "Vegetariano") return !tags.includes("carne");
  if (personalità === "Vegano") return tags.length === 0;
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
  return {
    ...abitante,
    inventario: creaInventarioIniziale(),
    ultimoGiornoCiboConsumato: undefined
  };
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

export type VoceInventarioDisplay = {
  def: OggettoInventarioDef;
  quantità: number;
};

export function getVociInventarioPerCategoria(
  inventario: VoceInventario[] | undefined,
  categoria: CategoriaInventario
): VoceInventarioDisplay[] {
  return normalizzaInventarioAbitante(inventario)
    .filter((v) => OGGETTI_INVENTARIO[v.itemId]?.categoria === categoria)
    .map((v) => ({
      def: OGGETTI_INVENTARIO[v.itemId]!,
      quantità: v.quantità
    }));
}
