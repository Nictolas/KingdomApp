import type { Abitante, Edificio } from "../types";
import { abitanteHaInventarioPersonale, getCastaAbitante } from "./casta";
import { abitanteDeveConsumareCiboGiornaliero } from "./consumoCiboInventario";
import { applicaRecuperoFamePasto } from "./bisogni";
import {
  abitantePuòConsumareOggettoCibo,
  isOggettoCibo,
  normalizzaInventarioGiocatore,
  normalizzaInventarioMensa,
  trasferisciCiboTraInventari,
  VOCI_CIBO_IDS,
  type VoceInventario
} from "./inventario";

export const NOME_MENSA_PUBBLICA = "Mensa Pubblica";

/** True se l'inventario ha almeno un oggetto Cibo compatibile con la dieta. */
export function haCiboCompatibileInInventario(
  inventario: VoceInventario[] | undefined,
  personalità: string,
  permesso: (itemId: string) => boolean = () => true
): boolean {
  if (!inventario?.length) return false;
  return inventario.some(
    (v) =>
      isOggettoCibo(v.itemId) &&
      v.quantità > 0 &&
      abitantePuòConsumareOggettoCibo(personalità, v.itemId) &&
      permesso(v.itemId)
  );
}

/** True se la mensa ha almeno un cibo compatibile con la dieta dell'abitante. */
export function haCiboCompatibileInInventarioMensa(
  inventarioMensa: VoceInventario[] | undefined,
  personalità: string
): boolean {
  return normalizzaInventarioMensa(inventarioMensa).some(
    (v) => v.quantità > 0 && abitantePuòConsumareOggettoCibo(personalità, v.itemId) &&
      permesso(v.itemId)
  );
}

export function mensaOperativaInColonia(edifici: Edificio[]): boolean {
  return edifici.some((e) => e.nome === NOME_MENSA_PUBBLICA && e.stato === "Operativo");
}

/**
 * True se l'abitante deve recarsi in mensa:
 * Servo / senza cibo personale compatibile (e mensa operativa).
 * La Fame urgente alza la priorità nello scheduler, ma la mensa resta per chi non può mangiare da solo.
 */
export function abitanteHaBisognoMensa(abitante: Abitante, edifici: Edificio[]): boolean {
  if (!abitanteDeveConsumareCiboGiornaliero(abitante)) return false;
  if (!mensaOperativaInColonia(edifici)) return false;
  const casta = getCastaAbitante(abitante);
  if (casta === "Schiavo") return false;
  if (casta === "Servo della gleba") return true;
  if (!abitanteHaInventarioPersonale(abitante)) return true;
  return !haCiboCompatibileInInventario(abitante.inventario, abitante.personalità);
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

/** Preleva 1 pasto compatibile dalle scorte mensa; null se nessuno disponibile. */
export function consumaPastoDaInventarioMensa(
  inventarioMensa: VoceInventario[],
  personalità: string,
  permesso: (itemId: string) => boolean = () => true
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

export type PastoMensaResult = {
  abitante: Abitante;
  inventarioMensa: VoceInventario[];
  /** True se il pasto è stato servito; false se la mensa non aveva cibo. */
  servito: boolean;
  /** True se la mensa non aveva cibo sufficiente. */
  carestiaMensa: boolean;
};

/** Pasto servito in mensa: preleva dalle scorte mensa senza generare cibo. */
export function serviPastoMensaTransaction(
  abitante: Abitante,
  inventarioMensa: VoceInventario[],
  giornoGioco: number,
  permesso: (itemId: string) => boolean = () => true
): PastoMensaResult {
  const mensaNorm = normalizzaInventarioMensa(inventarioMensa);
  if (!abitanteDeveConsumareCiboGiornaliero(abitante)) {
    return { abitante, inventarioMensa: mensaNorm, servito: false, carestiaMensa: false };
  }

  const pasto = consumaPastoDaInventarioMensa(mensaNorm, abitante.personalità, permesso);
  if (!pasto) {
    return { abitante, inventarioMensa: mensaNorm, servito: false, carestiaMensa: true };
  }

  return {
    abitante: applicaRecuperoFamePasto({ ...abitante, ultimoGiornoCiboConsumato: giornoGioco }),
    inventarioMensa: pasto.inventarioMensa,
    servito: true,
    carestiaMensa: false
  };
}

/** @deprecated Usare serviPastoMensaTransaction. */
export function applicaPastoMensaCompletato(abitante: Abitante, giornoGioco: number): Abitante {
  return serviPastoMensaTransaction(abitante, [], giornoGioco).abitante;
}
