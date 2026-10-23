import type { Abitante, Edificio } from "../types";
import type { ReligioneCustom } from "./fedeleCulto";
import { vietatoCiboDaDogma } from "./dogmiReligiosi";
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
  personalità: string,
  permesso: (itemId: string) => boolean
): { inventarioMensaByEdificioId: Record<number, VoceInventario[]>; ok: boolean; itemId: string | null } {
  let next = { ...inventarioMensaByEdificioId };
  for (const id of mensaIds) {
    const inv = next[id] ?? [];
    const pasto = consumaPastoDaInventarioMensa(inv, personalità, permesso);
    if (pasto) {
      next = { ...next, [id]: pasto.inventarioMensa };
      return { inventarioMensaByEdificioId: next, ok: true, itemId: pasto.itemId };
    }
  }
  return { inventarioMensaByEdificioId: next, ok: false, itemId: null };
}

function tentaPastoDaPadrone(
  abitanti: Abitante[],
  schiavo: Abitante,
  permesso: (itemId: string) => boolean
): { abitanti: Abitante[]; ok: boolean; itemId: string | null } {
  const padroneId = schiavo.schiavistaId;
  if (padroneId == null) return { abitanti, ok: false, itemId: null };
  const idx = abitanti.findIndex((a) => a.id === padroneId);
  if (idx < 0) return { abitanti, ok: false, itemId: null };
  const padrone = abitanti[idx]!;
  if (!padrone.inventario?.length) return { abitanti, ok: false, itemId: null };
  const dopo = consumaUnOggettoCiboConItem(padrone.inventario, schiavo.personalità, permesso);
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
  giorno: number,
  religioniCustom: readonly ReligioneCustom[]
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
    const dogmi = religioniCustom.find(r => r.nome === a.religione)?.dogmi ?? [];
    const permesso = (itemId: string) => !vietatoCiboDaDogma(dogmi, itemId);

    const ultimo = a.ultimoGiornoCiboConsumato;
    if (ultimo != null && giorno <= ultimo) continue;

    const casta = getCastaAbitante(a);
    let nutrito = false;
    let itemIdConsumato: string | null = null;

    if (casta === "Schiavo") {
      const daPadrone = tentaPastoDaPadrone(nextAbitanti, a, permesso);
      nextAbitanti = daPadrone.abitanti;
      nutrito = daPadrone.ok;
      itemIdConsumato = daPadrone.itemId;
    } else if (abitanteHaInventarioPersonale(a) && haCiboCompatibileInInventario(a.inventario, a.personalità, permesso)) {
      const dopo = consumaUnOggettoCiboConItem(a.inventario!, a.personalità, permesso);
      if (dopo) {
        a = { ...a, inventario: dopo.inventario };
        nutrito = true;
        itemIdConsumato = dopo.itemId;
      }
    }

    if (!nutrito && casta !== "Schiavo") {
      const acquisto = eseguiAcquistoPastoDaEmporio(a, nextEdifici, nextEmporio, permesso);
      if (acquisto.ok) {
        a = acquisto.abitante;
        nextEdifici = acquisto.edifici;
        nextEmporio = acquisto.inventarioEmporioByEdificioId;
        if (acquisto.scambio) scambiEmporio.push(acquisto.scambio);
        const dopoAcquisto = consumaUnOggettoCiboConItem(a.inventario ?? [], a.personalità, permesso);
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
        const daMensa = tentaPastoDaMensa(nextMensa, mensaIds, a.personalità, permesso);
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
  giornoA: number,
  religioniCustom: readonly ReligioneCustom[] = []
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
      g,
      religioniCustom
    );
    nextAbitanti = res.abitanti.map((a) => {
      let next = applicaDecayBisogniGiornaliero(a, {
        nomeResidenza: getEdificioAbitazione(a.id, edifici)?.nome ?? null
      });
      next = applicaDrainEnergiaLavoro(next);
      const dogmi = religioniCustom.find(r => r.nome === next.religione)?.dogmi ?? [];
      const snack = tentaSnackDaInventario(
        next, itemId => !vietatoCiboDaDogma(dogmi, itemId)
      );
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
  ultimoGiornoPasti: number,
  religioniCustom: readonly ReligioneCustom[] = []
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
    giornoGioco,
    religioniCustom
  );
}
