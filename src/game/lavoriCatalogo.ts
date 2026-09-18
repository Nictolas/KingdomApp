import type { Abitante } from "../types";
import { edificiData } from "../data/edificiData";
import { EDIFICIO_TO_LAVORO, OCCUPAZIONI_RIMOSSE } from "./edificiLavoro";
import { isGiocatore, LAVORO_GIOCATORE } from "./schiavituCommercio";
import { LAVORI_RACCOLTA, etichettaProduceRaccolta } from "../data/lavoriRaccolta";
import { MONETE_PER_UNITA_METALLO } from "./zeccaProduzione";

export type LavoroCatalogoVoce = {
  lavoro: string;
  slug: string;
  emoji: string;
};

/** Occupazioni non mostrate nella griglia Occupati (restano su /lavori o altrove). */
export const LAVORI_ESCLUSI_DA_GRIGLIA = new Set(["Disoccupato", "Neonato"]);

/** Occupazioni rimosse: re-export da edificiLavoro. */
export { OCCUPAZIONI_RIMOSSE } from "./edificiLavoro";

const EMOJI_LAVORO: Record<string, string> = {
  Taglialegna: "🪵",
  Fabbro: "🔨",
  Minatore: "⛏️",
  Agricoltore: "🌾",
  Ricercatore: "🔬",
  Medico: "⚕️",
  Insegnante: "📚",
  Giudice: "⚖️",
  Sicurezza: "🛡️",
  Guardia: "⚔️",
  Consigliere: "📜",
  Barista: "☕",
  Funzionario: "🏛️",
  Commerciante: "🏪",
  Mercante: "🧺",
  Cuoco: "👨‍🍳",
  Oste: "🍲",
  Raccoglitore: "🌲",
  Monetiere: "🪙",
  Religioso: "⛪",
  Sacerdote: "⛪",
  Edile: "🏗️",
  Esploratore: "🧭",
  Mago: "🧙",
  Alchimista: "⚗️",
  Maestro: "📚",
  Falegname: "🪚",
  Conciatore: "🧴",
  Fornaio: "🍞",
  Ceraiolo: "🕯️",
  Sarto: "👕",
  Birraio: "🍺",
  Speziale: "🧪",
  Armaiolo: "🏹",
  Scriba: "📜",
  "Medico della Peste": "🏥",
  Necromante: "☠️",
  [LAVORO_GIOCATORE]: "👑",
  "Capo Religioso": "🙏",
  "Capo Spirituale": "🙏",
  Sacerdote: "⛪",
  Prigioniero: "⛓️",
  Pensionato: "🧓",
  Studente: "🎒",
  Apprendista: "📖",
  Tirocinante: "📝",
  ...Object.fromEntries(LAVORI_RACCOLTA.map((v) => [v.lavoro, v.emoji]))
};

const LAVORI_GENERAZIONE = [
  "Ricercatore",
  "Medico",
  "Agricoltore",
  "Taglialegna",
  "Fabbro",
  "Minatore",
  "Esploratore",
  "Sicurezza",
  "Mago"
] as const;

const LAVORI_SPECIALI = [
  LAVORO_GIOCATORE,
  "Consigliere",
  "Capo Religioso",
  "Capo Spirituale",
  "Sacerdote",
  "Prigioniero",
  "Pensionato",
  "Studente",
  "Apprendista",
  "Tirocinante"
] as const;

function normalizzaSlug(testo: string): string {
  return testo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function emojiPerLavoro(lavoro: string): string {
  return EMOJI_LAVORO[lavoro] ?? "💼";
}

function voceCatalogo(lavoro: string): LavoroCatalogoVoce {
  return {
    lavoro,
    slug: normalizzaSlug(lavoro),
    emoji: emojiPerLavoro(lavoro)
  };
}

/** Edifici collegati a un'occupazione (da EDIFICIO_TO_LAVORO). */
export function edificiPerOccupazione(lavoro: string): string[] {
  const nomi = new Set<string>();
  if (lavoro === LAVORO_GIOCATORE || lavoro === "Consigliere") {
    nomi.add("Castello");
  }
  for (const [idStr, lavoroEdificio] of Object.entries(EDIFICIO_TO_LAVORO)) {
    if (lavoroEdificio !== lavoro) continue;
    const edificio = edificiData.find((e) => e.id === Number(idStr));
    if (edificio) nomi.add(edificio.nome);
  }
  return [...nomi].sort((a, b) => a.localeCompare(b, "it"));
}

/** Solo edifici collegati (senza produzione raccolta). */
export function etichettaSoloEdificiOccupazione(lavoro: string): string {
  const edifici = edificiPerOccupazione(lavoro);
  if (edifici.length === 0) return "—";
  return edifici.join(" · ");
}

/** Solo oggetto raccolto (se mestiere di raccolta). */
export function etichettaProduceOccupazione(lavoro: string): string {
  if (lavoro === "Raccoglitore") return "🍄🌿🪵 Bottino casuale del bosco";
  if (lavoro === "Minatore") return "⛏️ 1 pezzo d’oro/giorno al regno + bottino; stipendio Tesoro";
  if (lavoro === "Monetiere") return `🪙 Conio Metalli → Tesoro (${MONETE_PER_UNITA_METALLO} monete/Metallo)`;
  return etichettaProduceRaccolta(lavoro) ?? "—";
}

/** Testo breve legacy: oggetto raccolto oppure edifici. */
export function etichettaEdificiOccupazione(lavoro: string): string {
  const raccolta = etichettaProduceRaccolta(lavoro);
  if (raccolta) return `→ ${raccolta}`;
  return etichettaSoloEdificiOccupazione(lavoro);
}

export function isOccupazioneRimossa(lavoro: string): boolean {
  return OCCUPAZIONI_RIMOSSE.has(lavoro);
}

/** Elenco canonico delle occupazioni presenti in gioco (ordine stabile). */
export const LAVORI_CATALOGO: LavoroCatalogoVoce[] = (() => {
  const visti = new Set<string>();
  const voci: LavoroCatalogoVoce[] = [];
  const aggiungi = (lavoro: string) => {
    if (LAVORI_ESCLUSI_DA_GRIGLIA.has(lavoro) || OCCUPAZIONI_RIMOSSE.has(lavoro) || visti.has(lavoro)) return;
    visti.add(lavoro);
    voci.push(voceCatalogo(lavoro));
  };

  for (const lavoro of new Set(Object.values(EDIFICIO_TO_LAVORO))) aggiungi(lavoro);
  for (const lavoro of LAVORI_GENERAZIONE) aggiungi(lavoro);
  for (const v of LAVORI_RACCOLTA) aggiungi(v.lavoro);
  for (const lavoro of LAVORI_SPECIALI) aggiungi(lavoro);

  return voci;
})();

const SLUG_TO_LAVORO = new Map(LAVORI_CATALOGO.map((v) => [v.slug, v.lavoro]));

export function lavoroEtichetta(abitante: Abitante): string {
  return isGiocatore(abitante) ? LAVORO_GIOCATORE : abitante.lavoro;
}

/** Per conteggi/catalogo: occupazioni rimosse contano come disoccupati. */
export function lavoroPerConteggioOccupati(abitante: Abitante): string {
  const lavoro = lavoroEtichetta(abitante);
  if (isOccupazioneRimossa(lavoro)) return "Disoccupato";
  return lavoro;
}

export function lavoroToSlug(lavoro: string): string {
  return normalizzaSlug(lavoro);
}

export function slugToLavoro(slug: string): string | null {
  const diretto = SLUG_TO_LAVORO.get(slug);
  if (diretto) return diretto;
  return null;
}

/** Risolve slug anche per occupazioni legacy non nel catalogo (es. «Cuoca»). */
export function resolveLavoroFromSlug(slug: string, abitanti: Abitante[]): string | null {
  const canonico = slugToLavoro(slug);
  if (canonico) return canonico;
  const visti = new Set<string>();
  for (const a of abitanti) {
    if (a.razza === "Golem") continue;
    const etichetta = lavoroEtichetta(a);
    if (LAVORI_ESCLUSI_DA_GRIGLIA.has(etichetta) || isOccupazioneRimossa(etichetta)) continue;
    if (lavoroToSlug(etichetta) === slug) visti.add(etichetta);
  }
  if (visti.size === 1) return [...visti][0];
  return null;
}

export type OccupazioneConConteggio = LavoroCatalogoVoce & {
  count: number;
  edifici: string[];
};

/** Griglia Occupati: tutte le occupazioni in catalogo + eventuali extra nei dati salvati. */
export function elencoOccupazioniConConteggio(abitanti: Abitante[]): OccupazioneConConteggio[] {
  const conteggi = new Map<string, number>();

  for (const a of abitanti) {
    if (a.razza === "Golem") continue;
    const lavoro = lavoroPerConteggioOccupati(a);
    if (LAVORI_ESCLUSI_DA_GRIGLIA.has(lavoro)) continue;
    conteggi.set(lavoro, (conteggi.get(lavoro) ?? 0) + 1);
  }

  const visti = new Set<string>();
  const risultato: OccupazioneConConteggio[] = [];

  for (const voce of LAVORI_CATALOGO) {
    visti.add(voce.lavoro);
    risultato.push({
      ...voce,
      count: conteggi.get(voce.lavoro) ?? 0,
      edifici: edificiPerOccupazione(voce.lavoro)
    });
  }

  const extra = [...conteggi.keys()]
    .filter((l) => !visti.has(l) && !isOccupazioneRimossa(l))
    .sort((a, b) => a.localeCompare(b, "it"));

  for (const lavoro of extra) {
    risultato.push({
      ...voceCatalogo(lavoro),
      count: conteggi.get(lavoro) ?? 0,
      edifici: edificiPerOccupazione(lavoro)
    });
  }

  return risultato;
}

export function abitantiConOccupazione(abitanti: Abitante[], lavoro: string): Abitante[] {
  return abitanti
    .filter((a) => a.razza !== "Golem" && lavoroEtichetta(a) === lavoro)
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}
