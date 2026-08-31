import type { Abitante, Edificio } from "../types";
import { èNotteRoutineMappaDaBuio } from "./cicloCielo";
import { abitanteVuoleBarPerBisogni } from "./bisogni";

/** Fascia in minuti da mezzanotte [0, 1440). */
export type FasciaOrariaMinuti = { inizio: number; fine: number };

/** Giornata tipo ufficio / produzione (8:00–17:00). */
const LAVORO_STANDARD: FasciaOrariaMinuti = { inizio: 8 * 60, fine: 17 * 60 };

/** Preghiera collettiva nei Luoghi di Culto (10:00–11:00). */
export const FASCIA_PREGHIERA_CULTO: FasciaOrariaMinuti = { inizio: 10 * 60, fine: 11 * 60 };

/**
 * Edifici assegnabili con lavoratori: durante la fascia non mostriamo il personaggio in giro sulla mappa.
 * Stesso orario per tutti (personalizzabile per nome in seguito).
 */
const NOMI_CON_ORARIO_LAVORO = new Set<string>([
  "Serra",
  "Raffineria Mineraria",
  "Laboratorio di Ricerca",
  "Centrale Energetica",
  "Impianto di Riciclo",
  "Dissalatore",
  "Ospedale",
  "Hangar di Manutenzione",
  "Scuola",
  "Asilo",
  "Scuola Elementare",
  "Scuola Superiore",
  "Università",
  "Tribunale",
  "Ufficio Immigrazione",
  "Ufficio Edile",
  "Mercato",
  "Caserma",
  "Centrale",
  "Bar",
  "Spazioporto"
]);

/** Override opzionale per nome edificio (stessi minuti del resto del gioco). */
const FASCE_CUSTOM: Partial<Record<string, FasciaOrariaMinuti>> = {};

function normalizzaMinuti(m: number): number {
  return ((m % 1440) + 1440) % 1440;
}

/** `fine` escluso: es. 8–17 → [480, 1020) include 16:59, esclude 17:00. */
export function minutiInFascia(minutiDaMezzanotte: number, fascia: FasciaOrariaMinuti): boolean {
  const t = normalizzaMinuti(minutiDaMezzanotte);
  const { inizio, fine } = fascia;
  if (fine <= inizio) {
    return t >= inizio || t < fine;
  }
  return t >= inizio && t < fine;
}

export function fasciaPerEdificio(e: Edificio): FasciaOrariaMinuti | null {
  if (e.tipo === "Prigione" || e.tipo === "Residenza") return null;
  if (!NOMI_CON_ORARIO_LAVORO.has(e.nome)) return null;
  return FASCE_CUSTOM[e.nome] ?? LAVORO_STANDARD;
}

/** Primo edificio produttivo a cui l’abitante è assegnato (per ancoraggio mappa). */
export function primoEdificioLavoroOrarioPerAbitante(
  abitanteId: number,
  edificiList: Edificio[]
): Edificio | undefined {
  for (const e of edificiList) {
    if (!(e.abitantiAssegnati ?? []).includes(abitanteId)) continue;
    if (fasciaPerEdificio(e)) return e;
  }
  return undefined;
}

/**
 * True se l’abitante è assegnato a un edificio con orario e l’orologio di gioco è in fascia lavorativa.
 * In quel caso non va disegnato come passeggiatore sulla mappa.
 */
export function abitanteInOrarioLavoroEdificio(
  abitanteId: number,
  minutiDaMezzanotte: number,
  edificiList: Edificio[]
): boolean {
  for (const e of edificiList) {
    if (!(e.abitantiAssegnati ?? []).includes(abitanteId)) continue;
    const fascia = fasciaPerEdificio(e);
    if (fascia && minutiInFascia(minutiDaMezzanotte, fascia)) return true;
  }
  return false;
}

/**
 * Disoccupati (non Robot) di giorno: al Bar solo se Divertimento/Socialità lo richiedono.
 */
export function abitanteDisoccupatoAlBarOra(
  abitante: Abitante,
  minutiDaMezzanotte: number,
  buioCielo: number,
  edificiList: Edificio[]
): boolean {
  if (abitante.razza === "Golem") return false;
  if (abitante.lavoro !== "Disoccupato") return false;
  if (èNotteRoutineMappaDaBuio(buioCielo)) return false;
  if (abitanteInOrarioLavoroEdificio(abitante.id, minutiDaMezzanotte, edificiList)) return false;
  return abitanteVuoleBarPerBisogni(abitante);
}

/**
 * Di giorno, fuori fascia lavoro: al Bar solo se i bisogni Divertimento/Socialità lo richiedono.
 */
export function abitanteAlBarRoutineOra(
  abitante: Abitante,
  minutiDaMezzanotte: number,
  buioCielo: number,
  edificiList: Edificio[]
): boolean {
  if (abitante.razza === "Golem") return false;
  if (èNotteRoutineMappaDaBuio(buioCielo)) return false;
  if (abitanteInOrarioLavoroEdificio(abitante.id, minutiDaMezzanotte, edificiList)) return false;
  return abitanteVuoleBarPerBisogni(abitante);
}

export function abitantiPresentiNelBarOra(
  abitantiList: Abitante[],
  minutiDaMezzanotte: number,
  buioCielo: number,
  edificiList: Edificio[]
): Abitante[] {
  return abitantiList.filter((a) => abitanteAlBarRoutineOra(a, minutiDaMezzanotte, buioCielo, edificiList));
}

export function abitanteInOrarioPreghieraCulto(
  minutiDaMezzanotte: number,
  buioCielo: number
): boolean {
  if (èNotteRoutineMappaDaBuio(buioCielo)) return false;
  return minutiInFascia(minutiDaMezzanotte, FASCIA_PREGHIERA_CULTO);
}
