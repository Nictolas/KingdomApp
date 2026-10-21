import type { Abitante, Edificio } from "../types";
import { getEdificiOccupazione } from "./abitanteEdifici";
import {
  abitanteCercaLavoroPerSoldi,
  abitanteVuolePrendereLavoro,
  getBisogniAbitante
} from "./bisogni";
import { puoCercareLavoroAutonomamente } from "./edificiLavoro";
import { abitanteSoggettoACoprifuoco, type ConfigCoprifuoco } from "./coprifuoco";
import { getMoneteInventarioAbitante } from "./inventario";
import {
  abitanteAlBarRoutineOra,
  abitanteInOrarioLavoroEdificio,
  primoEdificioLavoroOrarioPerAbitante
} from "./orariLavoroMappa";
import { abitanteNascostoNelCultoOra } from "./presenzaLuogoCulto";

/** Recupera il nome completo dal vero ID del partner di conversazione. */
export function nomeInterlocutoreChiacchiera(
  abitanteId: number,
  interlocutoreById: Readonly<Record<number, number>>,
  abitanti: ReadonlyArray<Pick<Abitante, "id" | "nome">>
): string | null {
  const partnerId = interlocutoreById[abitanteId];
  if (partnerId == null || partnerId === abitanteId) return null;
  const nome = abitanti.find((altro) => altro.id === partnerId)?.nome.trim();
  return nome || null;
}

export type CommuteInfoAzione = {
  purpose: "work" | "bar" | "home" | "mensa" | "culto" | "negozio" | "rapina" | "cerca_lavoro";
  barEdificioId?: number;
  mensaEdificioId?: number;
  cultoEdificioId?: number;
  negozioEdificioId?: number;
  lavoroCercaEdificioId?: number;
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
    /** Due abitanti «in giro» fermi a chiacchierare. */
    staChiacchierando?: boolean;
    /** Nome completo del partner effettivo, se disponibile. */
    nomeInterlocutoreChiacchiera?: string | null;
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
      case "culto":
        return "Sta andando al luogo di culto";
      case "rapina":
        return "Sta andando a rubare";
    }
  }

  if (esitoRapinaRecente) return esitoRapinaRecente;

  if (opts.staChiacchierando) {
    const nome = opts.nomeInterlocutoreChiacchiera?.trim();
    return nome ? `Sta chiacchierando con ${nome}` : "Sta chiacchierando";
  }

  const èNotte = buioCielo > 0.5;
  if (èNotte && haCasa && dormonoACasaIds.has(abitante.id)) {
    return "Sta dormendo a casa sua";
  }

  if (
    abitanteInOrarioLavoroEdificio(abitante.id, orologioMinuti, edifici) &&
    lavoroArrivatiIds.has(abitante.id)
  ) {
    const sede =
      primoEdificioLavoroOrarioPerAbitante(abitante.id, edifici) ??
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
    return "Sta girando per la colonia";
  }

  if (
    coprifuoco &&
    abitanteSoggettoACoprifuoco(abitante, edifici, coprifuoco, orologioMinuti)
  ) {
    return "Rispetta il coprifuoco";
  }

  const monete = getMoneteInventarioAbitante(abitante.inventario);
  if (abitanteCercaLavoroPerSoldi(abitante, monete)) return "Cerca lavoro";
  if (
    puoCercareLavoroAutonomamente(abitante)
  ) {
    return "Cerca lavoro";
  }

  const b = getBisogniAbitante(abitante);
  if (b.fame < 45) return "Ha fame";
  if (b.divertimento < 45 || b.socialita < 45) return "Cerca svago";
  if (b.energia < 45) return "È stanco";
  if (b.igiene < 45) return "Ha bisogno di igiene";
  return "È in giro";
}
