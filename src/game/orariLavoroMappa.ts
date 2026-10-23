import type { Abitante, Edificio } from "../types";
import { èNotteRoutineMappaDaBuio } from "./cicloCielo";
import { abitanteVuoleBarPerBisogni } from "./bisogni";
import { LAVORO_GUARDIA, NOME_CASTELLO } from "./castelloGuardie";
import { elencoCantieri, NOME_UFFICIO_EDILE } from "./costruzioneEdifici";
import { orarioPerEdificio, orarioPerLavoro, type FasciaOrariaMinuti } from "./orariLavoroCatalogo";
import { ID_GIOCATORE } from "./schiavituCommercio";

/** Giornata tipo ufficio / produzione (8:00–17:00). */
const LAVORO_STANDARD: FasciaOrariaMinuti = { inizio: 8 * 60, fine: 17 * 60 };

/** Preghiera collettiva nei Luoghi di Culto (10:00–11:00). */
export const FASCIA_PREGHIERA_CULTO: FasciaOrariaMinuti = { inizio: 10 * 60, fine: 11 * 60 };

/**
 * Edifici assegnabili con lavoratori: durante la fascia non mostriamo il personaggio in giro sulla mappa.
 * L'orario deriva dal mestiere associato (catalogo in orariLavoroCatalogo).
 */
const NOMI_CON_ORARIO_LAVORO = new Set<string>([
  "Castello",
  "Serra",
  "Miniera",
  "Fucina",
  "Emporio",
  "Falegnameria",
  "Conceria",
  "Forno",
  "Cereria",
  "Sartoria",
  "Birrificio",
  "Taverna",
  "Spezieria",
  "Armeria",
  "Forgia",
  "Chiesa",
  "Lazzaretto",
  "Scriptorium",
  "Laboratorio Magico",
  "Cripta Necromantica",
  "Laboratorio di Ricerca",
  "Impianto di Riciclo",
  "Ospedale",
  "Remessa dei Carri",
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
  "Porto",
  "Zecca",
  "Bosco",
  "Capanna del Cacciatore",
  "Campo dei Taglialegna",
  "Capanno del Guardaboschi",
  "Erboristeria",
  "Apiario",
  "Vivaio forestale",
  "Miniera"
]);

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

/**
 * True se l’orologio ha appena lasciato la fascia (era dentro a `prev`, fuori a `cur`).
 * Usato per far uscire i lavoratori a fine turno del loro mestiere (non a un’ora fissa globale).
 */
export function attraversaFineFasciaLavoro(
  prevMinuti: number,
  curMinuti: number,
  fascia: FasciaOrariaMinuti
): boolean {
  return minutiInFascia(prevMinuti, fascia) && !minutiInFascia(curMinuti, fascia);
}

export function fasciaPerEdificio(e: Edificio): FasciaOrariaMinuti | null {
  if (e.tipo === "Prigione" || e.tipo === "Residenza") return null;
  const daOccupazione = orarioPerEdificio(e);
  if (daOccupazione) return daOccupazione;
  if (!NOMI_CON_ORARIO_LAVORO.has(e.nome)) return null;
  return LAVORO_STANDARD;
}

/** Primo edificio produttivo a cui l’abitante è assegnato (per ancoraggio mappa). */
export function primoEdificioLavoroOrarioPerAbitante(
  abitanteId: number,
  edificiList: Edificio[],
  abitantiList?: readonly Pick<Abitante, "id" | "lavoro" | "casta">[]
): Edificio | undefined {
  // Il Re risiede nel Castello ma non ha un orario da dipendente.
  if (abitanteId === ID_GIOCATORE) return undefined;
  const ab = abitantiList?.find((a) => a.id === abitanteId);
  for (const e of edificiList) {
    if (!(e.abitantiAssegnati ?? []).includes(abitanteId)) continue;
    // Solo le Guardie hanno turno al Castello. Consigliere/Nobili (e chiunque altro
    // assegnato) ne escono a inizio partita e non devono rientrare «per lavoro».
    if (e.nome === NOME_CASTELLO || e.id === 1) {
      if (!ab || ab.lavoro !== LAVORO_GUARDIA) continue;
    }
    if (fasciaPerEdificio(e)) return e;
  }
  return undefined;
}

/**
 * Destinazione fisica del turno di lavoro.
 * Gli Edili dell’Ufficio Edile vanno al primo cantiere in lista (se c’è), altrimenti restano in Ufficio.
 */
export function destinazioneLavoroOrarioPerAbitante(
  abitanteId: number,
  edificiList: Edificio[],
  abitantiList?: readonly Pick<Abitante, "id" | "lavoro" | "casta">[]
): Edificio | undefined {
  const sede = primoEdificioLavoroOrarioPerAbitante(abitanteId, edificiList, abitantiList);
  if (!sede) return undefined;
  if (sede.nome === NOME_UFFICIO_EDILE) {
    const cantiere = elencoCantieri(edificiList)[0];
    if (cantiere) return cantiere;
  }
  return sede;
}

/**
 * True se l’abitante è assegnato a un edificio con orario e l’orologio di gioco è in fascia lavorativa.
 * In quel caso non va disegnato come passeggiatore sulla mappa.
 */
export function abitanteInOrarioLavoroEdificio(
  abitanteId: number,
  minutiDaMezzanotte: number,
  edificiList: Edificio[],
  abitantiList?: readonly Pick<Abitante, "id" | "lavoro" | "casta">[]
): boolean {
  if (abitanteId === ID_GIOCATORE) return false;
  const sede = primoEdificioLavoroOrarioPerAbitante(abitanteId, edificiList, abitantiList);
  if (!sede) return false;
  const fascia = fasciaPerEdificio(sede);
  if (!fascia) return false;
  return minutiInFascia(minutiDaMezzanotte, fascia);
}

/**
 * True se l’occupazione dell’abitante ha una fascia oraria e l’orologio è dentro quella fascia.
 * Usato per interrompere idle/chiacchiere e mandarlo al lavoro.
 */
export function abitanteInOrarioOccupazione(
  abitante: Pick<Abitante, "id" | "lavoro">,
  minutiDaMezzanotte: number
): boolean {
  if (abitante.id === ID_GIOCATORE) return false;
  const fascia = orarioPerLavoro(abitante.lavoro);
  if (!fascia) return false;
  return minutiInFascia(minutiDaMezzanotte, fascia);
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
  if (abitanteInOrarioLavoroEdificio(abitante.id, minutiDaMezzanotte, edificiList, [abitante]))
    return false;
  return abitanteVuoleBarPerBisogni(abitante);
}

/**
 * Di giorno, fuori fascia lavoro: può andare al Bar (ritrovo sociale di default).
 */
export function abitanteAlBarRoutineOra(
  abitante: Abitante,
  minutiDaMezzanotte: number,
  buioCielo: number,
  edificiList: Edificio[]
): boolean {
  if (abitante.razza === "Golem") return false;
  if (èNotteRoutineMappaDaBuio(buioCielo)) return false;
  if (abitanteInOrarioLavoroEdificio(abitante.id, minutiDaMezzanotte, edificiList, [abitante]))
    return false;
  return true;
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
