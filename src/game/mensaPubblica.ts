import type { Abitante, Edificio } from "../types";
import { applicaConsumoCiboGiornalieroAbitante, abitanteDeveConsumareCiboGiornaliero } from "./consumoCiboInventario";
import {
  abitantePuòConsumareOggettoCibo,
  isOggettoCibo,
  normalizzaInventarioAbitante,
  normalizzaInventarioGiocatore,
  normalizzaInventarioMensa,
  trasferisciCiboTraInventari,
  type VoceInventario
} from "./inventario";

export const NOME_MENSA_PUBBLICA = "Mensa Pubblica";

const MENU_MENSA = ["mela", "latte", "uovo", "bistecca"] as const;

/** True se l'inventario ha almeno un oggetto Cibo compatibile con la dieta. */
export function haCiboCompatibileInInventario(
  inventario: VoceInventario[] | undefined,
  personalità: string
): boolean {
  return normalizzaInventarioAbitante(inventario).some(
    (v) =>
      isOggettoCibo(v.itemId) &&
      v.quantità > 0 &&
      abitantePuòConsumareOggettoCibo(personalità, v.itemId)
  );
}

/** True se la mensa ha almeno un cibo compatibile con la dieta dell'abitante. */
export function haCiboCompatibileInInventarioMensa(
  inventarioMensa: VoceInventario[] | undefined,
  personalità: string
): boolean {
  return normalizzaInventarioMensa(inventarioMensa).some(
    (v) => v.quantità > 0 && abitantePuòConsumareOggettoCibo(personalità, v.itemId)
  );
}

export function mensaOperativaInColonia(edifici: Edificio[]): boolean {
  return edifici.some((e) => e.nome === NOME_MENSA_PUBBLICA && e.stato === "Operativo");
}

/** True se l'abitante deve recarsi in mensa (niente cibo compatibile e mensa operativa). */
export function abitanteHaBisognoMensa(abitante: Abitante, edifici: Edificio[]): boolean {
  if (!abitanteDeveConsumareCiboGiornaliero(abitante)) return false;
  if (haCiboCompatibileInInventario(abitante.inventario, abitante.personalità)) return false;
  return mensaOperativaInColonia(edifici);
}

export function trasferisciCiboGiocatoreAMensaPuro(
  inventarioGiocatore: VoceInventario[],
  inventarioMensa: VoceInventario[],
  itemId: string,
  quantità: number
): { inventarioGiocatore: VoceInventario[]; inventarioMensa: VoceInventario[] } | null {
  const result = trasferisciCiboTraInventari(
    inventarioGiocatore,
    inventarioMensa,
    itemId,
    quantità,
    normalizzaInventarioGiocatore,
    normalizzaInventarioMensa
  );
  if (!result) return null;
  return { inventarioGiocatore: result.da, inventarioMensa: result.a };
}

function itemPastoMensaPerPersonalità(personalità: string): string {
  const compat = MENU_MENSA.filter((id) => abitantePuòConsumareOggettoCibo(personalità, id));
  if (compat.length === 0) return "mela";
  return compat[Math.floor(Math.random() * compat.length)]!;
}

/** Preleva 1 pasto compatibile dalle scorte mensa; null se nessuno disponibile. */
function consumaPastoDaInventarioMensa(
  inventarioMensa: VoceInventario[],
  personalità: string
): { inventarioMensa: VoceInventario[]; itemId: string } | null {
  const inv = normalizzaInventarioMensa(inventarioMensa);
  const idx = inv.findIndex(
    (v) => v.quantità > 0 && abitantePuòConsumareOggettoCibo(personalità, v.itemId)
  );
  if (idx < 0) return null;
  const itemId = inv[idx]!.itemId;
  const nextMensa = inv.map((v, i) => (i === idx ? { ...v, quantità: v.quantità - 1 } : v));
  return { inventarioMensa: nextMensa, itemId };
}

function aggiungiOggettoCiboAInventarioAbitante(abitante: Abitante, itemId: string): Abitante {
  const inv = normalizzaInventarioAbitante(abitante.inventario);
  const next = inv.map((v) => (v.itemId === itemId ? { ...v, quantità: v.quantità + 1 } : v));
  return { ...abitante, inventario: next };
}

/** Aggiunge 1 pasto compatibile con la dieta all'inventario (generato se scorte mensa esaurite). */
export function aggiungiPastoMensaAInventario(abitante: Abitante): Abitante {
  const itemId = itemPastoMensaPerPersonalità(abitante.personalità);
  return aggiungiOggettoCiboAInventarioAbitante(abitante, itemId);
}

/** Pasto servito in mensa: usa scorte mensa se disponibili, altrimenti genera cibo. */
export function serviPastoMensaTransaction(
  abitante: Abitante,
  inventarioMensa: VoceInventario[],
  giornoGioco: number
): { abitante: Abitante; inventarioMensa: VoceInventario[] } {
  if (!abitanteDeveConsumareCiboGiornaliero(abitante)) {
    return { abitante, inventarioMensa: normalizzaInventarioMensa(inventarioMensa) };
  }

  const pasto = consumaPastoDaInventarioMensa(inventarioMensa, abitante.personalità);
  const conCibo = pasto
    ? aggiungiOggettoCiboAInventarioAbitante(abitante, pasto.itemId)
    : aggiungiPastoMensaAInventario(abitante);

  return {
    abitante: applicaConsumoCiboGiornalieroAbitante(conCibo, giornoGioco),
    inventarioMensa: pasto?.inventarioMensa ?? normalizzaInventarioMensa(inventarioMensa)
  };
}

/** @deprecated Usare serviPastoMensaTransaction. */
export function applicaPastoMensaCompletato(abitante: Abitante, giornoGioco: number): Abitante {
  return serviPastoMensaTransaction(abitante, [], giornoGioco).abitante;
}
