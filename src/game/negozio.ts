import type { Abitante, Edificio } from "../types";
import { abitanteHaInventarioPersonale } from "./casta";
import {
  abitanteHaFameUrgente,
  applicaRecuperoFamePasto,
  getBisogniAbitante,
  SOGLIA_BISOGNO_AZIONE
} from "./bisogni";
import {
  consumaUnOggettoCibo,
  getMoneteInventarioAbitante,
  normalizzaInventarioAbitante,
  provaSpendiMoneteInventarioAbitante,
  type VoceInventario
} from "./inventario";
import { haCiboCompatibileInInventario } from "./mensaPubblica";

export const NOME_NEGOZIO = "Negozio";

/** Prezzo in monete per 1 unità di cibo base al Negozio. */
export const PREZZO_CIBO_NEGOZIO = 3;

/** Item venduto di default (vegetale, compatibile con quasi tutte le diete). */
export const ITEM_CIBO_NEGOZIO = "mela";

export function negozioOperativoInColonia(edifici: Edificio[]): boolean {
  return edifici.some((e) => e.nome === NOME_NEGOZIO && e.stato === "Operativo");
}

/**
 * Fame urgente, monete, Negozio operativo, senza cibo compatibile in inventario.
 */
export function abitanteVuoleNegozio(abitante: Abitante, edifici: Edificio[]): boolean {
  if (!abitanteHaFameUrgente(abitante)) return false;
  if (!abitanteHaInventarioPersonale(abitante)) return false;
  if (!negozioOperativoInColonia(edifici)) return false;
  if (haCiboCompatibileInInventario(abitante.inventario, abitante.personalità)) return false;
  return getMoneteInventarioAbitante(abitante.inventario) >= PREZZO_CIBO_NEGOZIO;
}

/** Compra 1 cibo e lo consuma subito (Fame ↑). */
export function compraEMangiaAlNegozio(abitante: Abitante): Abitante | null {
  if (!abitanteHaInventarioPersonale(abitante)) return null;
  const dopoSpesa = provaSpendiMoneteInventarioAbitante(abitante, PREZZO_CIBO_NEGOZIO);
  if (!dopoSpesa) return null;
  return applicaRecuperoFamePasto(dopoSpesa);
}

/** Compra 1 cibo e lo mette in inventario. */
export function compraCiboAlNegozio(abitante: Abitante): Abitante | null {
  if (!abitanteHaInventarioPersonale(abitante)) return null;
  const dopoSpesa = provaSpendiMoneteInventarioAbitante(abitante, PREZZO_CIBO_NEGOZIO);
  if (!dopoSpesa) return null;
  const inv = normalizzaInventarioAbitante(dopoSpesa.inventario);
  const idx = inv.findIndex((v) => v.itemId === ITEM_CIBO_NEGOZIO);
  const next: VoceInventario[] =
    idx >= 0
      ? inv.map((v, i) => (i === idx ? { ...v, quantità: v.quantità + 1 } : v))
      : [...inv, { itemId: ITEM_CIBO_NEGOZIO, quantità: 1 }];
  return { ...dopoSpesa, inventario: next };
}

/** Snack da inventario se Fame sotto soglia. */
export function tentaSnackDaInventario(abitante: Abitante): Abitante | null {
  if (!abitanteHaInventarioPersonale(abitante)) return null;
  if (getBisogniAbitante(abitante).fame >= SOGLIA_BISOGNO_AZIONE) return null;
  if (!haCiboCompatibileInInventario(abitante.inventario, abitante.personalità)) return null;
  const dopo = consumaUnOggettoCibo(abitante.inventario!, abitante.personalità);
  if (!dopo) return null;
  return applicaRecuperoFamePasto({ ...abitante, inventario: dopo });
}
