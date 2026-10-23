import type { Edificio } from "../types";
import { LAVORI_RACCOLTA } from "../data/lavoriRaccolta";
import { getLavoroPerEdificio } from "./edificiLavoro";
import { formatOrologioGioco } from "./orologioGiocoSession";
import { LAVORO_GIOCATORE } from "./schiavituCommercio";

/** Fascia in minuti da mezzanotte [0, 1440). `fine` esclusa. */
export type FasciaOrariaMinuti = { inizio: number; fine: number };

/** Minuti da mezzanotte → fascia { inizio, fine } con fine esclusa. */
function h(ore: number, minuti = 0): number {
  return ore * 60 + minuti;
}

/** Orari per occupazione: leggermente diversi tra mestieri simili. */
const ORARI_PER_LAVORO: Record<string, FasciaOrariaMinuti> = {
  Agricoltore: { inizio: h(6), fine: h(14) },
  Minatore: { inizio: h(7), fine: h(15) },
  Fornaio: { inizio: h(4), fine: h(12) },
  Fabbro: { inizio: h(8), fine: h(17) },
  Falegname: { inizio: h(7, 30), fine: h(16, 30) },
  Conciatore: { inizio: h(8, 30), fine: h(17, 30) },
  Ceraiolo: { inizio: h(9), fine: h(18) },
  Sarto: { inizio: h(9), fine: h(18) },
  Birraio: { inizio: h(7), fine: h(15) },
  Speziale: { inizio: h(9, 30), fine: h(18, 30) },
  Armaiolo: { inizio: h(8), fine: h(16) },
  Alchimista: { inizio: h(10), fine: h(19) },
  Necromante: { inizio: h(20), fine: h(4) },
  Medico: { inizio: h(8), fine: h(20) },
  "Medico della Peste": { inizio: h(7), fine: h(19) },
  Insegnante: { inizio: h(8), fine: h(15) },
  Maestro: { inizio: h(8, 30), fine: h(15, 30) },
  Studente: { inizio: h(8), fine: h(13) },
  Giudice: { inizio: h(9), fine: h(17) },
  Scriba: { inizio: h(9), fine: h(17) },
  Ricercatore: { inizio: h(10), fine: h(18) },
  Edile: { inizio: h(7), fine: h(16) },
  Barista: { inizio: h(11), fine: h(22) },
  Oste: { inizio: h(17), fine: h(1) },
  Commerciante: { inizio: h(8), fine: h(19) },
  Mercante: { inizio: h(8, 30), fine: h(18, 30) },
  Raccoglitore: { inizio: h(6, 30), fine: h(15, 30) },
  Monetiere: { inizio: h(8), fine: h(16) },
  Funzionario: { inizio: h(9), fine: h(17) },
  Sicurezza: { inizio: h(6), fine: h(14) },
  Guardia: { inizio: h(6), fine: h(14) },
  Consigliere: { inizio: h(9), fine: h(17) },
  Religioso: { inizio: h(9), fine: h(17) },
  Sacerdote: { inizio: h(8), fine: h(16) },
  "Capo Religioso": { inizio: h(9), fine: h(18) },
  "Capo Spirituale": { inizio: h(9), fine: h(18) },
  Taglialegna: { inizio: h(7), fine: h(16) },
  Cacciatore: { inizio: h(6), fine: h(15) },
  Guardaboschi: { inizio: h(7), fine: h(16) },
  Erborista: { inizio: h(7, 30), fine: h(16, 30) },
  Apicoltore: { inizio: h(6, 30), fine: h(15) },
  Silvicoltore: { inizio: h(7, 30), fine: h(16) },
  Esploratore: { inizio: h(7, 30), fine: h(17, 30) },
  Mago: { inizio: h(10), fine: h(19) },
  Cuoco: { inizio: h(6), fine: h(14) },
  Apprendista: { inizio: h(8), fine: h(16) },
  Tirocinante: { inizio: h(8, 30), fine: h(16, 30) }
};

/** Mestieri di raccolta: orario diurno sfalsato (6:00–7:45 inizio, 8–9 h di lavoro). */
function orarioRaccolta(indice: number): FasciaOrariaMinuti {
  const inizio = h(6) + (indice % 8) * 15;
  const durata = h(8) + (indice % 3) * 30;
  return { inizio, fine: inizio + durata };
}

for (let i = 0; i < LAVORI_RACCOLTA.length; i++) {
  const { lavoro } = LAVORI_RACCOLTA[i];
  if (!ORARI_PER_LAVORO[lavoro]) {
    ORARI_PER_LAVORO[lavoro] = orarioRaccolta(i);
  }
}

const OCCUPAZIONI_SENZA_ORARIO = new Set([
  "Disoccupato",
  "Neonato",
  "Pensionato",
  "Prigioniero",
  LAVORO_GIOCATORE
]);

/** Fascia oraria per occupazione, se definita. */
export function orarioPerLavoro(lavoro: string): FasciaOrariaMinuti | null {
  if (OCCUPAZIONI_SENZA_ORARIO.has(lavoro)) return null;
  return ORARI_PER_LAVORO[lavoro] ?? null;
}

/** Fascia oraria dell'edificio in base al mestiere associato. */
export function orarioPerEdificio(edificio: Edificio): FasciaOrariaMinuti | null {
  if (edificio.tipo === "Prigione" || edificio.tipo === "Residenza") return null;
  const lavoro = getLavoroPerEdificio(edificio);
  if (lavoro) return orarioPerLavoro(lavoro);
  return null;
}

/** Formato breve per UI: «08:00–17:00». */
export function formatFasciaOraria(fascia: FasciaOrariaMinuti): string {
  return `${formatOrologioGioco(fascia.inizio)}–${formatOrologioGioco(fascia.fine)}`;
}

/** Etichetta colonna Orario in /lavori. */
export function etichettaOrarioLavoro(lavoro: string): string {
  const fascia = orarioPerLavoro(lavoro);
  if (!fascia) return "—";
  return formatFasciaOraria(fascia);
}

/** True se l'occupazione ha un orario di lavoro definito. */
export function haOrarioLavoro(lavoro: string): boolean {
  return orarioPerLavoro(lavoro) != null;
}
