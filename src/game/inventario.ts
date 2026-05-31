import type { Abitante } from "../types";

export type CategoriaInventario = "Valuta" | "Cibo";

export type OggettoInventarioDef = {
  id: string;
  nome: string;
  emoji: string;
  categoria: CategoriaInventario;
};

export const CATEGORIA_CIBO: CategoriaInventario = "Cibo";

export const OGGETTI_INVENTARIO: Record<string, OggettoInventarioDef> = {
  monete: { id: "monete", nome: "Monete", emoji: "💰", categoria: "Valuta" },
  mela: { id: "mela", nome: "Mela", emoji: "🍎", categoria: CATEGORIA_CIBO }
};

export type VoceInventario = { itemId: string; quantità: number };

const INVENTARIO_INIZIALE: VoceInventario[] = [
  { itemId: "monete", quantità: 10 },
  { itemId: "mela", quantità: 5 }
];

/** Inventario di partenza per ogni abitante. */
export function creaInventarioIniziale(): VoceInventario[] {
  return INVENTARIO_INIZIALE.map((v) => ({ ...v }));
}

export function isOggettoCibo(itemId: string): boolean {
  return OGGETTI_INVENTARIO[itemId]?.categoria === CATEGORIA_CIBO;
}

export function getOggettoInventario(itemId: string): OggettoInventarioDef | undefined {
  return OGGETTI_INVENTARIO[itemId];
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

/** Consuma 1 unità del primo oggetto Cibo disponibile; null se nessuno. */
export function consumaUnOggettoCibo(inventario: VoceInventario[]): VoceInventario[] | null {
  const inv = normalizzaInventarioAbitante(inventario);
  const idx = inv.findIndex((v) => isOggettoCibo(v.itemId) && v.quantità > 0);
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
