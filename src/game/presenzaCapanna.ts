import type { Abitante, Edificio } from "../types";
import {
  abitanteAlBarRoutineOra,
  abitanteInOrarioLavoroEdificio
} from "./orariLavoroMappa";

/** Stato attuale rispetto alla capanna, coerente con i passeggiatori sulla mappa. */
export type StatoPresenzaCapanna =
  | "in_capanna"
  | "viaggio_casa"
  | "viaggio_lavoro"
  | "viaggio_bar"
  | "al_lavoro"
  | "al_bar"
  | "in_giro";

export function statoPresenzaOccupanteCapanna(
  abitante: Abitante,
  anchor: number,
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
): StatoPresenzaCapanna {
  const {
    buioCielo,
    orologioMinuti,
    dormonoACasaIds,
    commuteInfo,
    lavoroArrivatiIds,
    barArrivatiByEdificio,
    edifici
  } = opts;
  const èNottePersonaggiInCasa = buioCielo > 0.5;
  const inCommute = commuteInfo != null;

  if (
    homeCell === anchor &&
    èNottePersonaggiInCasa &&
    dormonoACasaIds.has(abitante.id) &&
    !inCommute
  ) {
    return "in_capanna";
  }

  if (inCommute) {
    const p = commuteInfo!.purpose;
    if (p === "home") return "viaggio_casa";
    if (p === "work") return "viaggio_lavoro";
    return "viaggio_bar";
  }

  const nascostoLavoro =
    abitanteInOrarioLavoroEdificio(abitante.id, orologioMinuti, edifici) &&
    lavoroArrivatiIds.has(abitante.id);

  if (nascostoLavoro) return "al_lavoro";

  const nascostoBar =
    abitanteAlBarRoutineOra(abitante, orologioMinuti, buioCielo, edifici) &&
    Object.values(barArrivatiByEdificio).some((ids) => ids.includes(abitante.id));

  if (nascostoBar) return "al_bar";

  return "in_giro";
}

export function etichettaStatoPresenza(s: StatoPresenzaCapanna): string {
  switch (s) {
    case "in_capanna":
      return "Dentro (in capanna)";
    case "viaggio_casa":
      return "In viaggio verso casa";
    case "viaggio_lavoro":
      return "In viaggio al lavoro";
    case "viaggio_bar":
      return "In viaggio al bar";
    case "al_lavoro":
      return "Al lavoro";
    case "al_bar":
      return "Al bar";
    case "in_giro":
      return "Fuori (in giro)";
  }
}

export function èDentroCapanna(s: StatoPresenzaCapanna): boolean {
  return s === "in_capanna";
}
