import type { Abitante, Edificio } from "../types";
import { abitanteHaInventarioPersonale, getCastaAbitante } from "./casta";
import { abitanteDeveConsumareCiboGiornaliero } from "./consumoCiboInventario";
import {
  consumaUnOggettoCiboConItem,
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
import { getEdificioAbitazione } from "./abitanteEdifici";
import { tentaSnackDaInventario } from "./negozio";
import { applicaBonusPastoGiorno } from "./soddisfazione";
import {
  applicaVenditeEccedenzeEmporioPerPeriodo,
  eseguiAcquistoPastoDaEmporio,
  type EmporioScambio
} from "./emporioVendita";

export type PastiGiornalieriResult = {
  abitanti: Abitante[];
  edifici: Edificio[];
  inventarioMensaByEdificioId: Record<number, VoceInventario[]>;
  inventarioEmporioByEdificioId: Record<number, VoceInventario[]>;
  scambiEmporio: EmporioScambio[];
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
  const dopo = consumaUnOggettoCiboConItem(padrone.inventario, schiavo.personalità);
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
): PastiGiornalieriResult {
  const mensaIds = idsMenseOperative(edifici);
  const mensaAttiva = mensaIds.length > 0;
  let nextAbitanti = abitanti.map(normalizzaAbitanteInventario);
  let nextEdifici = edifici;
  let nextMensa = { ...inventarioMensaByEdificioId };
  let nextEmporio = { ...inventarioEmporioByEdificioId };
  const scambiEmporio: EmporioScambio[] = [];
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
    } else if (abitanteHaInventarioPersonale(a) && haCiboCompatibileInInventario(a.inventario, a.personalità)) {
      const dopo = consumaUnOggettoCiboConItem(a.inventario!, a.personalità);
      if (dopo) {
        a = { ...a, inventario: dopo.inventario };
        nutrito = true;
        itemIdConsumato = dopo.itemId;
      }
    }

    if (!nutrito && casta !== "Schiavo") {
      const acquisto = eseguiAcquistoPastoDaEmporio(a, nextEdifici, nextEmporio);
      if (acquisto.ok) {
        a = acquisto.abitante;
        nextEdifici = acquisto.edifici;
        nextEmporio = acquisto.inventarioEmporioByEdificioId;
        if (acquisto.scambio) scambiEmporio.push(acquisto.scambio);
        const dopoAcquisto = consumaUnOggettoCiboConItem(a.inventario ?? [], a.personalità);
        if (dopoAcquisto) {
          a = { ...a, inventario: dopoAcquisto.inventario };
          nutrito = true;
          itemIdConsumato = dopoAcquisto.itemId;
        }
      }
    }

    if (!nutrito && casta !== "Schiavo") {
      if (!mensaAttiva) {
        carestiaMensa = true;
      } else {
        const daMensa = tentaPastoDaMensa(nextMensa, mensaIds, a.personalità);
        nextMensa = daMensa.inventarioMensaByEdificioId;
        nutrito = daMensa.ok;
        itemIdConsumato = daMensa.itemId;
        if (!nutrito) carestiaMensa = true;
      }
    }

    if (nutrito) {
      const dopoPasto = applicaRecuperoFamePasto({ ...a, ultimoGiornoCiboConsumato: giorno });
      nextAbitanti[i] = applicaBonusPastoGiorno(dopoPasto, giorno, itemIdConsumato);
    } else {
      nextAbitanti[i] = applicaBonusPastoGiorno(a, giorno, null);
    }
  }

  return {
    abitanti: nextAbitanti,
    edifici: nextEdifici,
    inventarioMensaByEdificioId: nextMensa,
    inventarioEmporioByEdificioId: nextEmporio,
    scambiEmporio,
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
  const scambiEmporio: EmporioScambio[] = [];
  let carestiaMensa = false;

  for (let g = giornoDa + 1; g <= giornoA; g++) {
    const vendite = applicaVenditeEccedenzeEmporioPerPeriodo(
      nextAbitanti,
      nextEdifici,
      nextEmporio,
      1
    );
    nextAbitanti = vendite.abitanti;
    nextEmporio = vendite.inventarioEmporioByEdificioId;
    scambiEmporio.push(...vendite.scambi);

    const res = applicaPastoSingoloGiorno(
      nextAbitanti,
      nextEdifici,
      nextMensa,
      nextEmporio,
      g
    );
    nextAbitanti = res.abitanti.map((a) => {
      let next = applicaDecayBisogniGiornaliero(a, {
        nomeResidenza: getEdificioAbitazione(a.id, edifici)?.nome ?? null
      });
      next = applicaDrainEnergiaLavoro(next);
      const snack = tentaSnackDaInventario(next);
      return snack ?? next;
    });
    nextEdifici = res.edifici;
    nextMensa = res.inventarioMensaByEdificioId;
    nextEmporio = res.inventarioEmporioByEdificioId;
    scambiEmporio.push(...res.scambiEmporio);
    if (res.carestiaMensa) carestiaMensa = true;
  }

  return {
    abitanti: nextAbitanti,
    edifici: nextEdifici,
    inventarioMensaByEdificioId: nextMensa,
    inventarioEmporioByEdificioId: nextEmporio,
    scambiEmporio,
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
      scambiEmporio: [],
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
