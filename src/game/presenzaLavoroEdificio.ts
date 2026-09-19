import type { Abitante, Edificio } from "../types";
import { getEdificioAbitazione } from "./abitanteEdifici";
import { èNotteRoutineMappaDaBuio } from "./cicloCielo";
import {
  abitanteAlBarRoutineOra,
  abitanteInOrarioLavoroEdificio,
  destinazioneLavoroOrarioPerAbitante
} from "./orariLavoroMappa";

/** Presenza rispetto a un edificio di lavoro (es. Serra), allineata ai passeggiatori sulla mappa. */
export type StatoPresenzaLavoroEdificio =
  | "dentro"
  | "viaggio_verso_questo"
  | "viaggio_verso_altro_lavoro"
  | "viaggio_casa"
  | "viaggio_bar"
  | "al_lavoro_altrove"
  | "al_bar"
  | "a_casa_notte"
  | "in_giro";

export function statoPresenzaLavoratoreEdificio(
  abitante: Abitante,
  edificio: Edificio,
  homeCell: number | null,
  opts: {
    buioCielo: number;
    orologioMinuti: number;
    dormonoACasaIds: Set<number>;
    commuteInfo: { purpose: "work" | "bar" | "home" } | undefined;
    lavoroArrivatiIds: Set<number>;
    barArrivatiByEdificio: Record<number, number[]>;
    edifici: Edificio[];
  }
): StatoPresenzaLavoroEdificio {
  const {
    buioCielo,
    orologioMinuti,
    dormonoACasaIds,
    commuteInfo,
    lavoroArrivatiIds,
    barArrivatiByEdificio,
    edifici
  } = opts;

  const assegnatoQui = (edificio.abitantiAssegnati ?? []).includes(abitante.id);
  if (!assegnatoQui) return "in_giro";

  const inCommute = commuteInfo != null;
  const èNotte = buioCielo > 0.5;
  const destinazione = destinazioneLavoroOrarioPerAbitante(abitante.id, edifici, [abitante]);

  if (homeCell !== null && èNotte && dormonoACasaIds.has(abitante.id) && !inCommute) {
    return "a_casa_notte";
  }

  if (inCommute) {
    const p = commuteInfo!.purpose;
    if (p === "home") return "viaggio_casa";
    if (p === "bar") return "viaggio_bar";
    if (destinazione?.id === edificio.id) return "viaggio_verso_questo";
    return "viaggio_verso_altro_lavoro";
  }

  const nascostoLavoro =
    abitanteInOrarioLavoroEdificio(abitante.id, orologioMinuti, edifici, [abitante]) &&
    lavoroArrivatiIds.has(abitante.id);

  if (nascostoLavoro) {
    if (destinazione?.id === edificio.id) return "dentro";
    return "al_lavoro_altrove";
  }

  const nascostoBar =
    abitanteAlBarRoutineOra(abitante, orologioMinuti, buioCielo, edifici) &&
    Object.values(barArrivatiByEdificio).some((ids) => ids.includes(abitante.id));

  if (nascostoBar) return "al_bar";

  return "in_giro";
}

/** True se l’abitante è in fascia oraria, assegnato a questo edificio e risulta entrato sulla mappa. */
export function lavoratoreDentroEdificioOra(
  abitanteId: number,
  edificioId: number,
  minutiDaMezzanotte: number,
  edificiList: Edificio[],
  lavoroArrivatiIds: ReadonlySet<number>,
  abitantiList?: readonly Pick<Abitante, "id" | "lavoro" | "casta">[]
): boolean {
  if (!lavoroArrivatiIds.has(abitanteId)) return false;
  if (!abitanteInOrarioLavoroEdificio(abitanteId, minutiDaMezzanotte, edificiList, abitantiList))
    return false;
  return destinazioneLavoroOrarioPerAbitante(abitanteId, edificiList, abitantiList)?.id === edificioId;
}

/**
 * Testo breve per la scheda lavoratori (es. Bar): dove si trova se non è in sede.
 * Usa orario + arrivi mappa + residenza; non richiede lo stato commute della mappa.
 */
export function etichettaDoveSiTrovaAddetto(
  abitante: Abitante,
  edificioId: number,
  minutiDaMezzanotte: number,
  buioCielo: number,
  edificiList: Edificio[],
  lavoroArrivatiIds: ReadonlySet<number>,
  abitantiList?: readonly Pick<Abitante, "id" | "lavoro" | "casta">[]
): { inServizio: boolean; testo: string } {
  const anagrafica = abitantiList ?? [abitante];
  if (
    lavoratoreDentroEdificioOra(
      abitante.id,
      edificioId,
      minutiDaMezzanotte,
      edificiList,
      lavoroArrivatiIds,
      anagrafica
    )
  ) {
    return { inServizio: true, testo: "In servizio" };
  }

  if (abitanteInOrarioLavoroEdificio(abitante.id, minutiDaMezzanotte, edificiList, anagrafica)) {
    const dest = destinazioneLavoroOrarioPerAbitante(abitante.id, edificiList, anagrafica);
    if (lavoroArrivatiIds.has(abitante.id) && dest && dest.id !== edificioId) {
      return { inServizio: false, testo: `Al lavoro (${dest.nome})` };
    }
    if (dest && dest.id !== edificioId) {
      return { inServizio: false, testo: `In viaggio verso ${dest.nome}` };
    }
    return { inServizio: false, testo: "In viaggio verso questa sede" };
  }

  if (èNotteRoutineMappaDaBuio(buioCielo)) {
    const casa = getEdificioAbitazione(abitante.id, edificiList);
    return {
      inServizio: false,
      testo: casa ? `A casa (${casa.nome})` : "A casa"
    };
  }

  return { inServizio: false, testo: "In giro" };
}

export function badgePresenzaLavoroEdificio(stato: StatoPresenzaLavoroEdificio): {
  èDentro: boolean;
  simbolo: string;
  titolo: "Dentro" | "Fuori";
  sottotitolo: string | null;
} {
  switch (stato) {
    case "dentro":
      return { èDentro: true, simbolo: "🌱", titolo: "Dentro", sottotitolo: null };
    case "viaggio_verso_questo":
      return { èDentro: false, simbolo: "🧭", titolo: "Fuori", sottotitolo: "Verso questa sede" };
    case "viaggio_verso_altro_lavoro":
      return { èDentro: false, simbolo: "🧭", titolo: "Fuori", sottotitolo: "Verso altra sede" };
    case "viaggio_casa":
      return { èDentro: false, simbolo: "🧭", titolo: "Fuori", sottotitolo: "Verso casa" };
    case "viaggio_bar":
      return { èDentro: false, simbolo: "🧭", titolo: "Fuori", sottotitolo: "Verso il bar" };
    case "al_lavoro_altrove":
      return { èDentro: false, simbolo: "🔧", titolo: "Fuori", sottotitolo: "Al lavoro (altra sede)" };
    case "al_bar":
      return { èDentro: false, simbolo: "🍺", titolo: "Fuori", sottotitolo: "Al bar" };
    case "a_casa_notte":
      return { èDentro: false, simbolo: "🌙", titolo: "Fuori", sottotitolo: "A casa (notte)" };
    case "in_giro":
      return { èDentro: false, simbolo: "🚶", titolo: "Fuori", sottotitolo: "In giro" };
  }
}
