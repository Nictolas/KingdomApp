import type { Abitante, Edificio } from "../types";
import { applicaConsumoCiboGiornalieroAbitante, abitanteDeveConsumareCiboGiornaliero } from "./consumoCiboInventario";
import {
  abitantePuòConsumareOggettoCibo,
  isOggettoCibo,
  normalizzaInventarioAbitante,
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

export function mensaOperativaInColonia(edifici: Edificio[]): boolean {
  return edifici.some((e) => e.nome === NOME_MENSA_PUBBLICA && e.stato === "Operativo");
}

/** True se l'abitante deve recarsi in mensa (niente cibo compatibile e mensa operativa). */
export function abitanteHaBisognoMensa(abitante: Abitante, edifici: Edificio[]): boolean {
  if (!abitanteDeveConsumareCiboGiornaliero(abitante)) return false;
  if (haCiboCompatibileInInventario(abitante.inventario, abitante.personalità)) return false;
  return mensaOperativaInColonia(edifici);
}

function itemPastoMensaPerPersonalità(personalità: string): string {
  const compat = MENU_MENSA.filter((id) => abitantePuòConsumareOggettoCibo(personalità, id));
  if (compat.length === 0) return "mela";
  return compat[Math.floor(Math.random() * compat.length)]!;
}

/** Aggiunge 1 pasto compatibile con la dieta all'inventario. */
export function aggiungiPastoMensaAInventario(abitante: Abitante): Abitante {
  const itemId = itemPastoMensaPerPersonalità(abitante.personalità);
  const inv = normalizzaInventarioAbitante(abitante.inventario);
  const next = inv.map((v) =>
    v.itemId === itemId ? { ...v, quantità: v.quantità + 1 } : v
  );
  return { ...abitante, inventario: next };
}

/** Pasto servito in mensa: aggiunge cibo e applica consumo giornaliero pendente. */
export function applicaPastoMensaCompletato(abitante: Abitante, giornoGioco: number): Abitante {
  if (!abitanteDeveConsumareCiboGiornaliero(abitante)) return abitante;
  const conPasto = aggiungiPastoMensaAInventario(abitante);
  return applicaConsumoCiboGiornalieroAbitante(conPasto, giornoGioco);
}
