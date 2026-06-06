import type { Abitante, Edificio } from "../types";
import {
  abitanteAlBarRoutineOra,
  abitanteInOrarioLavoroEdificio,
  abitanteInOrarioPreghieraCulto
} from "./orariLavoroMappa";

/** Presenza rispetto a un Luogo di Culto specifico (sulla mappa). */
export type StatoPresenzaLuogoCulto =
  | "nel_culto"
  | "viaggio_verso_culto"
  | "viaggio_casa"
  | "viaggio_lavoro"
  | "viaggio_bar"
  | "al_lavoro"
  | "al_bar"
  | "a_casa_notte"
  | "in_giro";

type CommutePurposeCulto = "work" | "bar" | "home" | "mensa" | "culto";

export function statoPresenzaFedeleLuogoCulto(
  abitante: Abitante,
  edificioGlobaleId: number,
  homeCell: number | null,
  opts: {
    buioCielo: number;
    orologioMinuti: number;
    dormonoACasaIds: Set<number>;
    commuteInfo:
      | { purpose: CommutePurposeCulto; cultoEdificioId?: number }
      | undefined;
    lavoroArrivatiIds: Set<number>;
    barArrivatiByEdificio: Record<number, number[]>;
    cultoArrivatiByEdificio: Record<number, number[]>;
    edifici: Edificio[];
  }
): StatoPresenzaLuogoCulto {
  const {
    buioCielo,
    orologioMinuti,
    dormonoACasaIds,
    commuteInfo,
    lavoroArrivatiIds,
    barArrivatiByEdificio,
    cultoArrivatiByEdificio,
    edifici
  } = opts;

  const arrivatiQui = cultoArrivatiByEdificio[edificioGlobaleId] ?? [];
  if (arrivatiQui.includes(abitante.id)) return "nel_culto";

  const inCommute = commuteInfo != null;
  if (inCommute) {
    const p = commuteInfo!.purpose;
    if (p === "culto" && commuteInfo!.cultoEdificioId === edificioGlobaleId) {
      return "viaggio_verso_culto";
    }
    if (p === "home") return "viaggio_casa";
    if (p === "work") return "viaggio_lavoro";
    return "viaggio_bar";
  }

  const èNotte = buioCielo > 0.5;
  if (homeCell !== null && èNotte && dormonoACasaIds.has(abitante.id)) {
    return "a_casa_notte";
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

export function badgePresenzaLuogoCulto(stato: StatoPresenzaLuogoCulto): {
  èDentro: boolean;
  simbolo: string;
  titolo: "Dentro" | "Fuori";
  sottotitolo: string | null;
} {
  switch (stato) {
    case "nel_culto":
      return { èDentro: true, simbolo: "🛐", titolo: "Dentro", sottotitolo: null };
    case "viaggio_verso_culto":
      return { èDentro: false, simbolo: "🧭", titolo: "Fuori", sottotitolo: "Verso il luogo di culto" };
    case "viaggio_casa":
      return { èDentro: false, simbolo: "🧭", titolo: "Fuori", sottotitolo: "Verso casa" };
    case "viaggio_lavoro":
      return { èDentro: false, simbolo: "🧭", titolo: "Fuori", sottotitolo: "Verso il lavoro" };
    case "viaggio_bar":
      return { èDentro: false, simbolo: "🧭", titolo: "Fuori", sottotitolo: "In viaggio" };
    case "al_lavoro":
      return { èDentro: false, simbolo: "🔧", titolo: "Fuori", sottotitolo: "Al lavoro" };
    case "al_bar":
      return { èDentro: false, simbolo: "🍺", titolo: "Fuori", sottotitolo: "Al bar" };
    case "a_casa_notte":
      return { èDentro: false, simbolo: "🌙", titolo: "Fuori", sottotitolo: "A casa (notte)" };
    case "in_giro":
      return { èDentro: false, simbolo: "🚶", titolo: "Fuori", sottotitolo: "In giro" };
  }
}

/** True se l'abitante dovrebbe recarsi al culto in questa fascia oraria (10:00–11:00). */
export function abitanteDeveAndareAlCultoOra(
  abitante: Abitante,
  minutiDaMezzanotte: number,
  buioCielo: number,
  edifici: Edificio[]
): boolean {
  if (abitante.razza === "Robot") return false;
  if (abitante.religione !== "Culto del Sole" && abitante.religione !== "Culto degli Alieni") {
    return false;
  }
  if (!abitanteInOrarioPreghieraCulto(minutiDaMezzanotte, buioCielo)) return false;
  if (abitanteInOrarioLavoroEdificio(abitante.id, minutiDaMezzanotte, edifici)) return false;
  return true;
}

/** Nascosto sulla mappa: in orario preghiera e già arrivato in un luogo di culto. */
export function abitanteNascostoNelCultoOra(
  abitante: Abitante,
  minutiDaMezzanotte: number,
  buioCielo: number,
  cultoArrivatiByEdificio: Record<number, number[]>
): boolean {
  if (!abitanteInOrarioPreghieraCulto(minutiDaMezzanotte, buioCielo)) return false;
  return Object.values(cultoArrivatiByEdificio).some((ids) => ids.includes(abitante.id));
}
