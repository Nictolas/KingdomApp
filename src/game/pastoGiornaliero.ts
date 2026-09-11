import type { Abitante, Edificio } from "../types";
import { abitanteHaInventarioPersonale, getCastaAbitante } from "./casta";
import { abitanteDeveConsumareCiboGiornaliero } from "./consumoCiboInventario";
import {
  consumaUnOggettoCiboConId,
  normalizzaAbitanteInventario,
  type VoceInventario
} from "./inventario";
import {
  consumaPastoDaInventarioMensa,
  haCiboCompatibileInInventario,
  NOME_MENSA_PUBBLICA
} from "./mensaPubblica";
import {
  applicaDecayBisogniGiornaliero,
  applicaDrainEnergiaLavoro,
  applicaRecuperoFamePasto,
  normalizzaAbitanteBisogni
} from "./bisogni";
import { getAlimentazioneAbitante } from "./alimentazione";
import { getEdificioAbitazione } from "./abitanteEdifici";
import { tentaSnackDaInventario } from "./negozio";
import { applicaBonusPastoGiorno, pulisciModificatoriScaduti } from "./soddisfazione";
import { eseguiAcquistoPastoDaEmporio } from "./emporioVendita";

export type PastiGiornalieriResult = {
  abitanti: Abitante[];
  edifici: Edificio[];
  inventarioMensaByEdificioId: Record<number, VoceInventario[]>;
  inventarioEmporioByEdificioId: Record<number, VoceInventario[]>;
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
): { inventarioMensaByEdificioId: Record<number, VoceInventario[]>; ok: boolean; itemId: string | null } {
  let next = { ...inventarioMensaByEdificioId };
  for (const id of mensaIds) {
    const inv = next[id] ?? [];
    const pasto = consumaPastoDaInventarioMensa(inv, personalità);
    if (pasto) {
      next = { ...next, [id]: pasto.inventarioMensa };
      return { inventarioMensaByEdificioId: next, ok: true, itemId: pasto.itemId };
    }
  }
  return { inventarioMensaByEdificioId: next, ok: false, itemId: null };
}

function tentaPastoDaPadrone(
  abitanti: Abitante[],
  schiavo: Abitante
): { abitanti: Abitante[]; ok: boolean; itemId: string | null } {
  const padroneId = schiavo.schiavistaId;
  if (padroneId == null) return { abitanti, ok: false, itemId: null };
  const idx = abitanti.findIndex((a) => a.id === padroneId);
  if (idx < 0) return { abitanti, ok: false, itemId: null };
  const padrone = abitanti[idx]!;
  if (!padrone.inventario?.length) return { abitanti, ok: false, itemId: null };
  const dopo = consumaUnOggettoCiboConId(padrone.inventario, getAlimentazioneAbitante(schiavo));
  if (!dopo) return { abitanti, ok: false, itemId: null };
  const next = [...abitanti];
  next[idx] = { ...padrone, inventario: dopo.inventario };
  return { abitanti: next, ok: true, itemId: dopo.itemId };
}

function applicaPastoSingoloGiorno(
  abitanti: Abitante[],
  edifici: Edificio[],
  inventarioMensaByEdificioId: Record<number, VoceInventario[]>,
  inventarioEmporioByEdificioId: Record<number, VoceInventario[]>,
  giorno: number
): {
  abitanti: Abitante[];
  edifici: Edificio[];
  inventarioMensaByEdificioId: Record<number, VoceInventario[]>;
  inventarioEmporioByEdificioId: Record<number, VoceInventario[]>;
  carestiaMensa: boolean;
} {
  const mensaIds = idsMenseOperative(edifici);
  const mensaAttiva = mensaIds.length > 0;
  let nextAbitanti = abitanti.map(normalizzaAbitanteInventario);
  let nextEdifici = edifici;
  let nextMensa = { ...inventarioMensaByEdificioId };
  let nextEmporio = { ...inventarioEmporioByEdificioId };
  let carestiaMensa = false;

  for (let i = 0; i < nextAbitanti.length; i++) {
    let a = nextAbitanti[i]!;
    if (!abitanteDeveConsumareCiboGiornaliero(a)) continue;

    const ultimo = a.ultimoGiornoCiboConsumato;
    if (ultimo != null && giorno <= ultimo) continue;

    const casta = getCastaAbitante(a);
    let nutrito = false;
    let itemIdConsumato: string | null = null;

    if (casta === "Schiavo") {
      const daPadrone = tentaPastoDaPadrone(nextAbitanti, a);
      nextAbitanti = daPadrone.abitanti;
      nutrito = daPadrone.ok;
      itemIdConsumato = daPadrone.itemId;
    } else if (abitanteHaInventarioPersonale(a) && haCiboCompatibileInInventario(a.inventario, getAlimentazioneAbitante(a))) {
      const dopo = consumaUnOggettoCiboConId(a.inventario!, getAlimentazioneAbitante(a));
      if (dopo) {
        a = { ...a, inventario: dopo.inventario };
        nutrito = true;
        itemIdConsumato = dopo.itemId;
      }
    }

    if (!nutrito && casta !== "Schiavo") {
      const daEmporio = eseguiAcquistoPastoDaEmporio(a, nextEdifici, nextEmporio);
      if (daEmporio.ok) {
        a = daEmporio.abitante;
        nextEdifici = daEmporio.edifici;
        nextEmporio = daEmporio.inventarioEmporioByEdificioId;
        const dopo = consumaUnOggettoCiboConId(a.inventario!, getAlimentazioneAbitante(a));
        if (dopo) {
          a = { ...a, inventario: dopo.inventario };
          nutrito = true;
          itemIdConsumato = dopo.itemId ?? daEmporio.itemId;
        }
      }
    }

    if (!nutrito && casta !== "Schiavo") {
      if (!mensaAttiva) {
        carestiaMensa = true;
      } else {
        const daMensa = tentaPastoDaMensa(nextMensa, mensaIds, getAlimentazioneAbitante(a));
        nextMensa = daMensa.inventarioMensaByEdificioId;
        nutrito = daMensa.ok;
        itemIdConsumato = daMensa.itemId;
        if (!nutrito) carestiaMensa = true;
      }
    }

    if (nutrito) {
      let next = applicaRecuperoFamePasto({ ...a, ultimoGiornoCiboConsumato: giorno });
      next = applicaBonusPastoGiorno(next, giorno, itemIdConsumato);
      nextAbitanti[i] = next;
    } else {
      nextAbitanti[i] = pulisciModificatoriScaduti(a, giorno, 1, 0);
    }
  }

  return {
    abitanti: nextAbitanti,
    edifici: nextEdifici,
    inventarioMensaByEdificioId: nextMensa,
    inventarioEmporioByEdificioId: nextEmporio,
    carestiaMensa
  };
}

/** Applica un pasto al giorno per ogni abitante nel periodo `(giornoDa, giornoA]`. */
export function applicaPastiGiornalieriPerPeriodo(
  abitanti: Abitante[],
  edifici: Edificio[],
  inventarioMensaByEdificioId: Record<number, VoceInventario[]>,
  inventarioEmporioByEdificioId: Record<number, VoceInventario[]>,
  giornoDa: number,
  giornoA: number
): PastiGiornalieriResult {
  let nextAbitanti = abitanti;
  let nextEdifici = edifici;
  let nextMensa = inventarioMensaByEdificioId;
  let nextEmporio = inventarioEmporioByEdificioId;
  let carestiaMensa = false;

  for (let g = giornoDa + 1; g <= giornoA; g++) {
    const res = applicaPastoSingoloGiorno(nextAbitanti, nextEdifici, nextMensa, nextEmporio, g);
    nextAbitanti = res.abitanti.map((a) => {
      let next = applicaDecayBisogniGiornaliero(a, {
        nomeResidenza: getEdificioAbitazione(a.id, nextEdifici)?.nome ?? null
      });
      next = applicaDrainEnergiaLavoro(next);
      const snack = tentaSnackDaInventario(next);
      return snack ?? next;
    });
    nextEdifici = res.edifici;
    nextMensa = res.inventarioMensaByEdificioId;
    nextEmporio = res.inventarioEmporioByEdificioId;
    if (res.carestiaMensa) carestiaMensa = true;
  }

  return {
    abitanti: nextAbitanti,
    edifici: nextEdifici,
    inventarioMensaByEdificioId: nextMensa,
    inventarioEmporioByEdificioId: nextEmporio,
    carestiaMensa
  };
}

/** Normalizza inventari e applica pasti fino al giorno di gioco corrente. */
export function normalizzaEAplicaPastiAbitanti(
  abitanti: Abitante[],
  edifici: Edificio[],
  inventarioMensaByEdificioId: Record<number, VoceInventario[]>,
  inventarioEmporioByEdificioId: Record<number, VoceInventario[]>,
  giornoGioco: number,
  ultimoGiornoPasti: number
): PastiGiornalieriResult {
  const base = abitanti.map((a) => normalizzaAbitanteBisogni(normalizzaAbitanteInventario(a)));
  if (giornoGioco <= ultimoGiornoPasti) {
    return {
      abitanti: base,
      edifici,
      inventarioMensaByEdificioId,
      inventarioEmporioByEdificioId,
      carestiaMensa: false
    };
  }
  return applicaPastiGiornalieriPerPeriodo(
    base,
    edifici,
    inventarioMensaByEdificioId,
    inventarioEmporioByEdificioId,
    ultimoGiornoPasti,
    giornoGioco
  );
}
