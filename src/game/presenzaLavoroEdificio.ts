import type { Abitante, Edificio } from "../types";
import {
  abitanteAlBarRoutineOra,
  abitanteInOrarioLavoroEdificio,
  primoEdificioLavoroOrarioPerAbitante
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
  const primo = primoEdificioLavoroOrarioPerAbitante(abitante.id, edifici);

  if (homeCell !== null && èNotte && dormonoACasaIds.has(abitante.id) && !inCommute) {
    return "a_casa_notte";
  }

  if (inCommute) {
    const p = commuteInfo!.purpose;
    if (p === "home") return "viaggio_casa";
    if (p === "bar") return "viaggio_bar";
    if (primo?.id === edificio.id) return "viaggio_verso_questo";
    return "viaggio_verso_altro_lavoro";
  }

  const nascostoLavoro =
    abitanteInOrarioLavoroEdificio(abitante.id, orologioMinuti, edifici) &&
    lavoroArrivatiIds.has(abitante.id);

  if (nascostoLavoro) {
    if (primo?.id === edificio.id) return "dentro";
    return "al_lavoro_altrove";
  }

  const nascostoBar =
    abitanteAlBarRoutineOra(abitante, orologioMinuti, buioCielo, edifici) &&
    Object.values(barArrivatiByEdificio).some((ids) => ids.includes(abitante.id));

  if (nascostoBar) return "al_bar";

  return "in_giro";
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
