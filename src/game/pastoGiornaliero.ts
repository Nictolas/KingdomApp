import type { Abitante, Edificio } from "../types";
import { abitanteHaInventarioPersonale, getCastaAbitante } from "./casta";
import { abitanteDeveConsumareCiboGiornaliero } from "./consumoCiboInventario";
import {
  consumaUnOggettoCibo,
  normalizzaAbitanteInventario,
  type VoceInventario
} from "./inventario";
import {
  consumaPastoDaInventarioMensa,
  haCiboCompatibileInInventario,
  NOME_MENSA_PUBBLICA
} from "./mensaPubblica";

export type PastiGiornalieriResult = {
  abitanti: Abitante[];
  inventarioMensaByEdificioId: Record<number, VoceInventario[]>;
  carestiaMensa: boolean;
};

function idsMenseOperative(edifici: Edificio[]): number[] {
  return edifici
    .filter((e) => e.nome === NOME_MENSA_PUBBLICA && e.stato === "Operativo")
    .map((e) => e.id);
}

function tentaPastoDaMensa(
  inventarioMensaByEdificioId: Record<number, VoceInventario[]>,
  mensaIds: number[],
  personalità: string
): { inventarioMensaByEdificioId: Record<number, VoceInventario[]>; ok: boolean } {
  let next = { ...inventarioMensaByEdificioId };
  for (const id of mensaIds) {
    const inv = next[id] ?? [];
    const pasto = consumaPastoDaInventarioMensa(inv, personalità);
    if (pasto) {
      next = { ...next, [id]: pasto.inventarioMensa };
      return { inventarioMensaByEdificioId: next, ok: true };
    }
  }
  return { inventarioMensaByEdificioId: next, ok: false };
}

function tentaPastoDaPadrone(
  abitanti: Abitante[],
  schiavo: Abitante
): { abitanti: Abitante[]; ok: boolean } {
  const padroneId = schiavo.schiavistaId;
  if (padroneId == null) return { abitanti, ok: false };
  const idx = abitanti.findIndex((a) => a.id === padroneId);
  if (idx < 0) return { abitanti, ok: false };
  const padrone = abitanti[idx]!;
  if (!padrone.inventario?.length) return { abitanti, ok: false };
  const dopo = consumaUnOggettoCibo(padrone.inventario, schiavo.personalità);
  if (!dopo) return { abitanti, ok: false };
  const next = [...abitanti];
  next[idx] = { ...padrone, inventario: dopo };
  return { abitanti: next, ok: true };
}

function applicaPastoSingoloGiorno(
  abitanti: Abitante[],
  edifici: Edificio[],
  inventarioMensaByEdificioId: Record<number, VoceInventario[]>,
  giorno: number
): { abitanti: Abitante[]; inventarioMensaByEdificioId: Record<number, VoceInventario[]>; carestiaMensa: boolean } {
  const mensaIds = idsMenseOperative(edifici);
  const mensaAttiva = mensaIds.length > 0;
  let nextAbitanti = abitanti.map(normalizzaAbitanteInventario);
  let nextMensa = { ...inventarioMensaByEdificioId };
  let carestiaMensa = false;

  for (let i = 0; i < nextAbitanti.length; i++) {
    let a = nextAbitanti[i]!;
    if (!abitanteDeveConsumareCiboGiornaliero(a)) continue;

    const ultimo = a.ultimoGiornoCiboConsumato;
    if (ultimo != null && giorno <= ultimo) continue;

    const casta = getCastaAbitante(a);
    let nutrito = false;

    if (casta === "Schiavo") {
      const daPadrone = tentaPastoDaPadrone(nextAbitanti, a);
      nextAbitanti = daPadrone.abitanti;
      nutrito = daPadrone.ok;
    } else if (abitanteHaInventarioPersonale(a) && haCiboCompatibileInInventario(a.inventario, a.personalità)) {
      const dopo = consumaUnOggettoCibo(a.inventario!, a.personalità);
      if (dopo) {
        a = { ...a, inventario: dopo };
        nutrito = true;
      }
    }

    if (!nutrito && casta !== "Schiavo") {
      if (!mensaAttiva) {
        carestiaMensa = true;
      } else {
        const daMensa = tentaPastoDaMensa(nextMensa, mensaIds, a.personalità);
        nextMensa = daMensa.inventarioMensaByEdificioId;
        nutrito = daMensa.ok;
        if (!nutrito) carestiaMensa = true;
      }
    }

    if (nutrito) {
      nextAbitanti[i] = { ...a, ultimoGiornoCiboConsumato: giorno };
    }
  }

  return { abitanti: nextAbitanti, inventarioMensaByEdificioId: nextMensa, carestiaMensa };
}

/** Applica un pasto al giorno per ogni abitante nel periodo `(giornoDa, giornoA]`. */
export function applicaPastiGiornalieriPerPeriodo(
  abitanti: Abitante[],
  edifici: Edificio[],
  inventarioMensaByEdificioId: Record<number, VoceInventario[]>,
  giornoDa: number,
  giornoA: number
): PastiGiornalieriResult {
  let nextAbitanti = abitanti;
  let nextMensa = inventarioMensaByEdificioId;
  let carestiaMensa = false;

  for (let g = giornoDa + 1; g <= giornoA; g++) {
    const res = applicaPastoSingoloGiorno(nextAbitanti, edifici, nextMensa, g);
    nextAbitanti = res.abitanti;
    nextMensa = res.inventarioMensaByEdificioId;
    if (res.carestiaMensa) carestiaMensa = true;
  }

  return { abitanti: nextAbitanti, inventarioMensaByEdificioId: nextMensa, carestiaMensa };
}

/** Normalizza inventari e applica pasti fino al giorno di gioco corrente. */
export function normalizzaEAplicaPastiAbitanti(
  abitanti: Abitante[],
  edifici: Edificio[],
  inventarioMensaByEdificioId: Record<number, VoceInventario[]>,
  giornoGioco: number,
  ultimoGiornoPasti: number
): PastiGiornalieriResult {
  const base = abitanti.map(normalizzaAbitanteInventario);
  if (giornoGioco <= ultimoGiornoPasti) {
    return { abitanti: base, inventarioMensaByEdificioId, carestiaMensa: false };
  }
  return applicaPastiGiornalieriPerPeriodo(base, edifici, inventarioMensaByEdificioId, ultimoGiornoPasti, giornoGioco);
}
