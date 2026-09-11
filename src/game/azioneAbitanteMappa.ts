import type { Abitante, Edificio } from "../types";
import { getEdificiOccupazione } from "./abitanteEdifici";
import {
  abitanteCercaLavoroPerSoldi,
  abitanteVuolePrendereLavoro,
  getBisogniAbitante
} from "./bisogni";
import { getCastaAbitante } from "./casta";
import { abitanteSoggettoACoprifuoco, type ConfigCoprifuoco } from "./coprifuoco";
import { getMoneteInventarioAbitante } from "./inventario";
import {
  abitanteAlBarRoutineOra,
  abitanteInOrarioLavoroEdificio,
  destinazioneLavoroOrarioPerAbitante
} from "./orariLavoroMappa";
import { abitanteNascostoNelCultoOra } from "./presenzaLuogoCulto";

export type CommuteInfoAzione = {
  purpose: "work" | "bar" | "home" | "mensa" | "culto" | "negozio" | "rapina" | "cerca_lavoro" | "vende_emporio" | "re_uscita";
  barEdificioId?: number;
  mensaEdificioId?: number;
  cultoEdificioId?: number;
  negozioEdificioId?: number;
  lavoroCercaEdificioId?: number;
  emporioVenditaEdificioId?: number;
};

function nomeEdificio(edifici: Edificio[], id: number | undefined): string | null {
  if (id == null) return null;
  return edifici.find((e) => e.id === id)?.nome ?? null;
}

function edificioBarDiAbitante(
  abitanteId: number,
  barArrivatiByEdificio: Record<number, number[]>,
  edifici: Edificio[]
): Edificio | undefined {
  for (const [k, ids] of Object.entries(barArrivatiByEdificio)) {
    if (ids.includes(abitanteId)) {
      const id = Number(k);
      return edifici.find((e) => e.id === id);
    }
  }
  return undefined;
}

function edificioCultoDiAbitante(
  abitanteId: number,
  cultoArrivatiByEdificio: Record<number, number[]>,
  edifici: Edificio[]
): Edificio | undefined {
  for (const [k, ids] of Object.entries(cultoArrivatiByEdificio)) {
    if (ids.includes(abitanteId)) {
      const id = Number(k);
      return edifici.find((e) => e.id === id);
    }
  }
  return undefined;
}

/**
 * Testo dell’azione in corso sulla mappa (scheda abitante), es. “Sta andando a lavoro”.
 */
export function descriviAzioneCorrenteAbitante(
  abitante: Abitante,
  opts: {
    edifici: Edificio[];
    buioCielo: number;
    orologioMinuti: number;
    dormonoACasaIds: Set<number>;
    lavoroArrivatiIds: Set<number>;
    barArrivatiByEdificio: Record<number, number[]>;
    cultoArrivatiByEdificio: Record<number, number[]>;
    commuteInfo?: CommuteInfoAzione;
    haCasa?: boolean;
    coprifuoco?: ConfigCoprifuoco;
    /** Esito recente di una rapina (es. «Ha rubato»). */
    esitoRapinaRecente?: string | null;
    /** Due abitanti «in giro» fermi uno accanto all’altro. */
    staChiacchierando?: boolean;
  }
): string {
  const {
    edifici,
    buioCielo,
    orologioMinuti,
    dormonoACasaIds,
    lavoroArrivatiIds,
    barArrivatiByEdificio,
    cultoArrivatiByEdificio,
    commuteInfo,
    haCasa = true,
    coprifuoco,
    esitoRapinaRecente
  } = opts;

  if (commuteInfo != null) {
    switch (commuteInfo.purpose) {
      case "work":
        return "Sta andando a lavoro";
      case "cerca_lavoro": {
        const nome = nomeEdificio(edifici, commuteInfo.lavoroCercaEdificioId);
        if (nome === "Emporio") return "Sta andando all'Emporio a chiedere lavoro";
        if (nome === "Bosco") return "Sta andando nel Bosco a raccogliere";
        if (nome === "Castello") return "Sta andando al Castello a chiedere lavoro";
        return nome ? `Sta andando a chiedere lavoro (${nome})` : "Sta andando a chiedere lavoro";
      }
      case "home":
        return "Sta andando a casa sua";
      case "bar": {
        const nome = nomeEdificio(edifici, commuteInfo.barEdificioId);
        return nome ? `Sta andando al bar (${nome})` : "Sta andando al bar";
      }
      case "mensa":
        return "Sta andando a mangiare";
      case "negozio":
        return "Sta andando al negozio";
      case "vende_emporio":
        return "Sta andando all'Emporio a vendere cibo";
      case "culto":
        return "Sta andando al luogo di culto";
      case "rapina":
        return "Sta andando a rubare";
      case "re_uscita":
        return "Sta uscendo dal Castello";
    }
  }

  if (esitoRapinaRecente) return esitoRapinaRecente;

  if (opts.staChiacchierando) return "Sta chiacchierando";

  // I Nobili sulla mappa restano «in giro» (non cercano lavoro né mestieri),
  // ma sopra restano visibili commute (es. uscita Castello) e chiacchiere.
  if (getCastaAbitante(abitante) === "Nobile") {
    return "È in giro";
  }

  const èNotte = buioCielo > 0.5;
  // In casa (arrivo commute home / notte): non mostrare «È in giro» o bisogni.
  if (haCasa && dormonoACasaIds.has(abitante.id)) {
    return èNotte ? "Sta dormendo a casa sua" : "A casa sua";
  }

  if (
    abitanteInOrarioLavoroEdificio(abitante.id, orologioMinuti, edifici, [abitante]) &&
    lavoroArrivatiIds.has(abitante.id)
  ) {
    const sede =
      destinazioneLavoroOrarioPerAbitante(abitante.id, edifici, [abitante]) ??
      getEdificiOccupazione(abitante.id, edifici)[0];
    return sede ? `Sta lavorando presso ${sede.nome}` : "Sta lavorando";
  }

  if (
    abitanteAlBarRoutineOra(abitante, orologioMinuti, buioCielo, edifici) &&
    Object.values(barArrivatiByEdificio).some((ids) => ids.includes(abitante.id))
  ) {
    const bar = edificioBarDiAbitante(abitante.id, barArrivatiByEdificio, edifici);
    return bar ? `Sta al bar presso ${bar.nome}` : "Sta al bar";
  }

  if (abitanteNascostoNelCultoOra(abitante, orologioMinuti, buioCielo, cultoArrivatiByEdificio)) {
    const culto = edificioCultoDiAbitante(abitante.id, cultoArrivatiByEdificio, edifici);
    return culto ? `Sta pregando presso ${culto.nome}` : "Sta pregando";
  }

  if (abitante.razza === "Golem") {
    if (
      coprifuoco &&
      abitanteSoggettoACoprifuoco(abitante, edifici, coprifuoco, orologioMinuti)
    ) {
      return "Rispetta il coprifuoco";
    }
    return "Sta girando per il regno";
  }

  if (
    coprifuoco &&
    abitanteSoggettoACoprifuoco(abitante, edifici, coprifuoco, orologioMinuti)
  ) {
    return "Rispetta il coprifuoco";
  }

  const monete = getMoneteInventarioAbitante(abitante.inventario);
  if (abitanteCercaLavoroPerSoldi(abitante, monete)) return "Cerca lavoro";
  if (abitanteVuolePrendereLavoro(abitante)) {
    return "Cerca lavoro";
  }

  const b = getBisogniAbitante(abitante);
  if (b.fame < 45) return "Ha fame";
  if (b.divertimento < 45 || b.socialita < 45) return "Cerca svago";
  if (b.energia < 45) return "È stanco";
  if (b.igiene < 45) return "Ha bisogno di igiene";
  return "È in giro";
}
