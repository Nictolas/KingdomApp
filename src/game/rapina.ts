import type { Abitante, Edificio, Reato } from "../types";
import { abitanteHaInventarioPersonale } from "./casta";
import {
  applicaRecuperoFamePasto,
  getBisogniAbitante,
  SOGLIA_BISOGNO_CRITICO
} from "./bisogni";
import { NOME_CENTRALE_POLIZIA } from "./coprifuoco";
import {
  getMoneteInventarioAbitante,
  prelevaCiboCompatibileDaAbitante,
  trasferisciMoneteTraAbitanti,
  type VoceInventario
} from "./inventario";
import {
  abitanteHaBisognoMensa,
  consumaPastoDaInventarioMensa,
  haCiboCompatibileInInventario,
  haCiboCompatibileInInventarioMensa,
  NOME_MENSA_PUBBLICA
} from "./mensaPubblica";
import {
  abitanteVuoleNegozio,
  NOME_NEGOZIO,
  negozioOperativoInColonia,
  tentaSnackDaInventario
} from "./negozio";
import { fasciaPerEdificio, minutiInFascia } from "./orariLavoroMappa";

/** Cooldown tra tentativi di rapina (minuti di gioco). */
export const COOLDOWN_RAPINA_MINUTI = 240;

const PROB_BOTTINO = 0.7;
const PROB_SCOPERTA_BASE = 0.35;
const BONUS_SCOPERTA_CENTRALE = 0.15;
const BONUS_SCOPERTA_STRADA_GIORNO = 0.1;
const MALUS_SCOPERTA_NOTTE = 0.1;

export type RapinaTarget =
  | { tipo: "abitante"; id: number }
  | { tipo: "edificio"; id: number; nome: typeof NOME_NEGOZIO | typeof NOME_MENSA_PUBBLICA };

export type ResolveRapinaResult = {
  nextLadro: Abitante;
  nextVittima?: Abitante;
  nextInventarioMensa?: { edificioId: number; inventario: VoceInventario[] };
  bottinoOttenuto: boolean;
  scoperto: boolean;
  messaggioScoperta?: string;
  testoAzione: string;
};

function distanzaCelleManhattan(a: number, b: number, cols: number): number {
  const ca = a % cols;
  const ra = Math.floor(a / cols);
  const cb = b % cols;
  const rb = Math.floor(b / cols);
  return Math.abs(ca - cb) + Math.abs(ra - rb);
}

function aggiungiReatoFurto(abitante: Abitante): Abitante {
  const reati = abitante.reati ?? [];
  if (reati.includes("Furto")) return abitante;
  return { ...abitante, reati: [...reati, "Furto" as Reato] };
}

/** Centrale operativa con ≥1 agente assegnato, in fascia oraria lavoro. */
export function centralePoliziaAttivaOra(edifici: Edificio[], minutiDaMezzanotte: number): boolean {
  const centrale = edifici.find(
    (e) => e.nome === NOME_CENTRALE_POLIZIA && e.stato === "Operativo"
  );
  if (!centrale) return false;
  if ((centrale.abitantiAssegnati ?? []).length < 1) return false;
  const fascia = fasciaPerEdificio(centrale);
  if (!fascia) return false;
  return minutiInFascia(minutiDaMezzanotte, fascia);
}

export function probabilitàScopertaRapina(opts: {
  edifici: Edificio[];
  minutiDaMezzanotte: number;
  èNotte: boolean;
  suStrada: boolean;
}): number {
  let p = PROB_SCOPERTA_BASE;
  const centraleAttiva = centralePoliziaAttivaOra(opts.edifici, opts.minutiDaMezzanotte);
  if (centraleAttiva) p += BONUS_SCOPERTA_CENTRALE;
  if (!opts.èNotte && opts.suStrada) p += BONUS_SCOPERTA_STRADA_GIORNO;
  // Notte / fuori orario Centrale: −10%
  if (opts.èNotte || !centraleAttiva) p -= MALUS_SCOPERTA_NOTTE;
  return Math.max(0.05, Math.min(0.95, p));
}

function qualcheMensaHaCiboCompatibile(
  abitante: Abitante,
  edifici: Edificio[],
  inventarioMensaByEdificioId: Record<number, VoceInventario[]>
): boolean {
  for (const e of edifici) {
    if (e.nome !== NOME_MENSA_PUBBLICA || e.stato !== "Operativo") continue;
    if (haCiboCompatibileInInventarioMensa(inventarioMensaByEdificioId[e.id], abitante.personalità)) {
      return true;
    }
  }
  return false;
}

/**
 * Eleggibilità: Fame critica, inventario personale, niente alternative legali immediate, cooldown ok.
 * Il coprifuoco va controllato dal chiamante (scheduler mappa).
 */
export function abitantePuòTentareRapina(
  abitante: Abitante,
  opts: {
    edifici: Edificio[];
    inventarioMensaByEdificioId: Record<number, VoceInventario[]>;
    /** Minuti assoluti di gioco (giorno*1440 + ora) dell'ultimo tentativo, o null. */
    ultimoTentativoAbsMinuti: number | null;
    oraAbsMinuti: number;
  }
): boolean {
  if (abitante.razza === "Robot") return false;
  if (!abitanteHaInventarioPersonale(abitante)) return false;
  if (getBisogniAbitante(abitante).fame >= SOGLIA_BISOGNO_CRITICO) return false;

  if (opts.ultimoTentativoAbsMinuti != null) {
    if (opts.oraAbsMinuti - opts.ultimoTentativoAbsMinuti < COOLDOWN_RAPINA_MINUTI) return false;
  }

  // Snack possibile → non rapinare
  if (tentaSnackDaInventario(abitante) != null) return false;

  const mensaLegale =
    abitanteHaBisognoMensa(abitante, opts.edifici) &&
    qualcheMensaHaCiboCompatibile(abitante, opts.edifici, opts.inventarioMensaByEdificioId);
  if (mensaLegale) return false;

  if (abitanteVuoleNegozio(abitante, opts.edifici)) return false;

  return true;
}

function vittimaHaBottinoUtile(vittima: Abitante, ladro: Abitante): boolean {
  if (!abitanteHaInventarioPersonale(vittima)) return false;
  if (getMoneteInventarioAbitante(vittima.inventario) >= 1) return true;
  return haCiboCompatibileInInventario(vittima.inventario, ladro.personalità);
}

/**
 * Candidati persona: umani in giro (cella nota), non Robot, non sé, con monete o cibo utile.
 * Preferenza: più monete, poi cibo; tra pari il più vicino.
 */
export function scegliBersaglioPersonaRapina(
  ladro: Abitante,
  abitanti: Abitante[],
  celleNote: Map<number, number>,
  opts: {
    cols: number;
    dormonoACasaIds: Set<number>;
    nascostiIds?: Set<number>;
  }
): RapinaTarget | null {
  const from = celleNote.get(ladro.id);
  if (from == null) return null;

  type Cand = { id: number; monete: number; haCibo: boolean; dist: number };
  const cands: Cand[] = [];

  for (const v of abitanti) {
    if (v.id === ladro.id) continue;
    if (v.razza === "Robot") continue;
    if (!abitanteHaInventarioPersonale(v)) continue;
    if (opts.dormonoACasaIds.has(v.id)) continue;
    if (opts.nascostiIds?.has(v.id)) continue;
    const cell = celleNote.get(v.id);
    if (cell == null) continue;
    if (!vittimaHaBottinoUtile(v, ladro)) continue;
    cands.push({
      id: v.id,
      monete: getMoneteInventarioAbitante(v.inventario),
      haCibo: haCiboCompatibileInInventario(v.inventario, ladro.personalità),
      dist: distanzaCelleManhattan(from, cell, opts.cols)
    });
  }

  if (cands.length === 0) return null;

  cands.sort((a, b) => {
    if (b.monete !== a.monete) return b.monete - a.monete;
    if (a.haCibo !== b.haCibo) return a.haCibo ? -1 : 1;
    return a.dist - b.dist;
  });

  return { tipo: "abitante", id: cands[0]!.id };
}

/** Negozio operativo, altrimenti Mensa con cibo compatibile (più vicina). */
export function scegliBersaglioEdificioRapina(
  ladro: Abitante,
  fromCell: number,
  edifici: Edificio[],
  inventarioMensaByEdificioId: Record<number, VoceInventario[]>,
  findEdificioCell: (edificioId: number) => number | null,
  cols: number
): RapinaTarget | null {
  if (negozioOperativoInColonia(edifici)) {
    const negozi = edifici.filter((e) => e.nome === NOME_NEGOZIO && e.stato === "Operativo");
    let best: { id: number; dist: number } | null = null;
    for (const e of negozi) {
      const cell = findEdificioCell(e.id);
      if (cell == null) continue;
      const dist = distanzaCelleManhattan(fromCell, cell, cols);
      if (!best || dist < best.dist) best = { id: e.id, dist };
    }
    if (best) return { tipo: "edificio", id: best.id, nome: NOME_NEGOZIO };
  }

  const mense = edifici.filter((e) => e.nome === NOME_MENSA_PUBBLICA && e.stato === "Operativo");
  let bestMensa: { id: number; dist: number } | null = null;
  for (const e of mense) {
    if (!haCiboCompatibileInInventarioMensa(inventarioMensaByEdificioId[e.id], ladro.personalità)) {
      continue;
    }
    const cell = findEdificioCell(e.id);
    if (cell == null) continue;
    const dist = distanzaCelleManhattan(fromCell, cell, cols);
    if (!bestMensa || dist < bestMensa.dist) bestMensa = { id: e.id, dist };
  }
  if (bestMensa) return { tipo: "edificio", id: bestMensa.id, nome: NOME_MENSA_PUBBLICA };

  return null;
}

export function scegliBersaglioRapina(
  ladro: Abitante,
  abitanti: Abitante[],
  celleNote: Map<number, number>,
  edifici: Edificio[],
  inventarioMensaByEdificioId: Record<number, VoceInventario[]>,
  opts: {
    cols: number;
    dormonoACasaIds: Set<number>;
    nascostiIds?: Set<number>;
    findEdificioCell: (edificioId: number) => number | null;
  }
): RapinaTarget | null {
  const persona = scegliBersaglioPersonaRapina(ladro, abitanti, celleNote, opts);
  if (persona) return persona;
  const from = celleNote.get(ladro.id);
  if (from == null) return null;
  return scegliBersaglioEdificioRapina(
    ladro,
    from,
    edifici,
    inventarioMensaByEdificioId,
    opts.findEdificioCell,
    opts.cols
  );
}

function nomeAbitanteBreve(a: Abitante): string {
  return a.nome?.trim() || `Abitante #${a.id}`;
}

/**
 * Risolve furto all'arrivo: roll bottino + scoperta indipendenti.
 * Fame critica → preferisci cibo; altrimenti monete.
 */
export function resolveRapina(
  ladro: Abitante,
  target: RapinaTarget,
  ctx: {
    abitanti: Abitante[];
    edifici: Edificio[];
    inventarioMensaByEdificioId: Record<number, VoceInventario[]>;
    minutiDaMezzanotte: number;
    èNotte: boolean;
    suStrada: boolean;
    rng?: () => number;
  }
): ResolveRapinaResult {
  const rng = ctx.rng ?? Math.random;
  const fameCritica = getBisogniAbitante(ladro).fame < SOGLIA_BISOGNO_CRITICO;
  let nextLadro = ladro;
  let nextVittima: Abitante | undefined;
  let nextInventarioMensa: ResolveRapinaResult["nextInventarioMensa"];
  let bottinoOttenuto = false;
  let labelVittima = "qualcuno";

  const rollBottino = rng() < PROB_BOTTINO;

  if (target.tipo === "abitante") {
    const vittima = ctx.abitanti.find((a) => a.id === target.id);
    if (vittima) {
      labelVittima = nomeAbitanteBreve(vittima);
      nextVittima = vittima;
      if (rollBottino) {
        const moneteV = getMoneteInventarioAbitante(vittima.inventario);
        const haCibo = haCiboCompatibileInInventario(vittima.inventario, ladro.personalità);
        const rubaCibo = (fameCritica && haCibo) || (!haCibo ? false : moneteV < 1);

        if (rubaCibo && haCibo) {
          const prel = prelevaCiboCompatibileDaAbitante(vittima, ladro.personalità);
          if (prel) {
            nextVittima = prel.vittima;
            nextLadro = applicaRecuperoFamePasto(nextLadro);
            bottinoOttenuto = true;
          }
        } else if (moneteV >= 1) {
          const q = Math.min(moneteV, 1 + Math.floor(rng() * 3));
          const tr = trasferisciMoneteTraAbitanti(vittima, nextLadro, q);
          if (tr) {
            nextVittima = tr.da;
            nextLadro = tr.a;
            bottinoOttenuto = true;
          }
        }
      }
    }
  } else if (target.nome === NOME_NEGOZIO) {
    labelVittima = NOME_NEGOZIO;
    if (rollBottino && negozioOperativoInColonia(ctx.edifici)) {
      // Furto 1 cibo senza pagare → mangia subito
      nextLadro = applicaRecuperoFamePasto(nextLadro);
      bottinoOttenuto = true;
    }
  } else {
    labelVittima = NOME_MENSA_PUBBLICA;
    if (rollBottino) {
      const inv = ctx.inventarioMensaByEdificioId[target.id] ?? [];
      const pasto = consumaPastoDaInventarioMensa(inv, ladro.personalità);
      if (pasto) {
        nextInventarioMensa = { edificioId: target.id, inventario: pasto.inventarioMensa };
        nextLadro = applicaRecuperoFamePasto(nextLadro);
        bottinoOttenuto = true;
      }
    }
  }

  const pScoperta = probabilitàScopertaRapina({
    edifici: ctx.edifici,
    minutiDaMezzanotte: ctx.minutiDaMezzanotte,
    èNotte: ctx.èNotte,
    suStrada: ctx.suStrada
  });
  const scoperto = rng() < pScoperta;

  if (scoperto) {
    nextLadro = aggiungiReatoFurto(nextLadro);
  }

  let testoAzione: string;
  if (bottinoOttenuto && !scoperto) {
    testoAzione = "Ha rubato";
  } else if (bottinoOttenuto && scoperto) {
    testoAzione = "Ha rubato (scoperto)";
  } else if (!bottinoOttenuto && scoperto) {
    testoAzione = "Tentato furto (scoperto)";
  } else {
    testoAzione = "Tentativo di furto fallito";
  }

  const messaggioScoperta = scoperto
    ? `${nomeAbitanteBreve(ladro)} è stato scoperto mentre rubava a ${labelVittima}`
    : undefined;

  return {
    nextLadro,
    nextVittima,
    nextInventarioMensa,
    bottinoOttenuto,
    scoperto,
    messaggioScoperta,
    testoAzione
  };
}
