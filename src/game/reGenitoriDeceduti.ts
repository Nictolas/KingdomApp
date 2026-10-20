/**
 * Genitori deceduti del Re (id=1): personaggi sintetici umani, stabili per partita,
 * non presenti sulla mappa. Visualizzati in bianco e nero nell’albero genealogico.
 * Include anche zio/zia deceduti per il cugino nobile (Avventura).
 */

import type { Abitante } from "../types";
import { ID_GIOCATORE } from "./schiavituCommercio";
import { COGNOMI_UMANI, NOMI_UMANI_CON_SESSO } from "./nomiUmani";
import { generaAspettoCasuale, type AspettoPersonaggio } from "./personaggioAspetto";

export const ID_PADRE_DECEDUTO_RE = -1001;
export const ID_MADRE_DECEDUTO_RE = -1002;
/** Fratello del padre deceduto del Re (genitore del cugino paterno). */
export const ID_ZIO_PATERNO_DECEDUTO_RE = -1003;
/** Sorella della madre deceduta del Re (genitore del cugino materno). */
export const ID_ZIA_MATERNA_DECEDUTA_RE = -1004;

export type LatoCuginoRe = "paterno" | "materno";

export type GenitoreDecedutoRe = {
  id: number;
  nome: string;
  sesso: "M" | "F";
  eta: number;
  aspetto: AspettoPersonaggio;
  deceduto: true;
};

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** PRNG deterministico (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cognomeDaNomeCompleto(nomeCompleto: string): string {
  const t = nomeCompleto.trim();
  const i = t.lastIndexOf(" ");
  if (i <= 0) return COGNOMI_UMANI[0]!;
  return t.slice(i + 1).trim() || COGNOMI_UMANI[0]!;
}

function pickNome(sesso: "M" | "F", random: () => number): string {
  const pool = NOMI_UMANI_CON_SESSO.filter((n) => n.sesso === sesso);
  const list = pool.length > 0 ? pool : NOMI_UMANI_CON_SESSO;
  return list[Math.floor(random() * list.length)]!.nome;
}

const cacheGenitori = new Map<string, [GenitoreDecedutoRe, GenitoreDecedutoRe]>();
const cacheZioZia = new Map<string, GenitoreDecedutoRe>();

/**
 * Due umani casuali (padre + madre), aspetto fisso per il Re corrente (seed da nome).
 */
export function getGenitoriDecedutiRe(re: Pick<Abitante, "id" | "nome">): [GenitoreDecedutoRe, GenitoreDecedutoRe] {
  const key = `${re.id}:${re.nome}`;
  const hit = cacheGenitori.get(key);
  if (hit) return hit;

  const cognome = cognomeDaNomeCompleto(re.nome);
  const random = mulberry32(hashString(key) ^ 0xdec0de);
  const nomePadre = pickNome("M", random);
  const nomeMadre = pickNome("F", random);

  const padre: GenitoreDecedutoRe = {
    id: ID_PADRE_DECEDUTO_RE,
    nome: `${nomePadre} ${cognome}`,
    sesso: "M",
    eta: 48 + Math.floor(random() * 20),
    aspetto: generaAspettoCasuale("Umano", random, { eta: 55, sesso: "M" }),
    deceduto: true
  };
  const madre: GenitoreDecedutoRe = {
    id: ID_MADRE_DECEDUTO_RE,
    nome: `${nomeMadre} ${cognome}`,
    sesso: "F",
    eta: 45 + Math.floor(random() * 18),
    aspetto: generaAspettoCasuale("Umano", random, { eta: 52, sesso: "F" }),
    deceduto: true
  };

  const pair: [GenitoreDecedutoRe, GenitoreDecedutoRe] = [padre, madre];
  cacheGenitori.set(key, pair);
  return pair;
}

/** Zio paterno o zia materna deceduti: genitore del cugino nobile. */
export function getZioZiaDecedutoCuginoRe(
  re: Pick<Abitante, "id" | "nome">,
  lato: LatoCuginoRe
): GenitoreDecedutoRe {
  const key = `${re.id}:${re.nome}:${lato}`;
  const hit = cacheZioZia.get(key);
  if (hit) return hit;

  const [padre, madre] = getGenitoriDecedutiRe(re);
  const random = mulberry32(hashString(key) ^ 0xc001);
  if (lato === "paterno") {
    const cognome = cognomeDaNomeCompleto(padre.nome);
    const nome = pickNome("M", random);
    const zio: GenitoreDecedutoRe = {
      id: ID_ZIO_PATERNO_DECEDUTO_RE,
      nome: `${nome} ${cognome}`,
      sesso: "M",
      eta: 44 + Math.floor(random() * 18),
      aspetto: generaAspettoCasuale("Umano", random, { eta: 50, sesso: "M" }),
      deceduto: true
    };
    cacheZioZia.set(key, zio);
    return zio;
  }
  const cognome = cognomeDaNomeCompleto(madre.nome);
  const nome = pickNome("F", random);
  const zia: GenitoreDecedutoRe = {
    id: ID_ZIA_MATERNA_DECEDUTA_RE,
    nome: `${nome} ${cognome}`,
    sesso: "F",
    eta: 42 + Math.floor(random() * 16),
    aspetto: generaAspettoCasuale("Umano", random, { eta: 48, sesso: "F" }),
    deceduto: true
  };
  cacheZioZia.set(key, zia);
  return zia;
}

export function èIdGenitoreDecedutoRe(id: number): boolean {
  return (
    id === ID_PADRE_DECEDUTO_RE ||
    id === ID_MADRE_DECEDUTO_RE ||
    id === ID_ZIO_PATERNO_DECEDUTO_RE ||
    id === ID_ZIA_MATERNA_DECEDUTA_RE
  );
}

export function risolviParenteDecedutoRe(
  id: number,
  re: Pick<Abitante, "id" | "nome">
): GenitoreDecedutoRe | null {
  if (id === ID_PADRE_DECEDUTO_RE || id === ID_MADRE_DECEDUTO_RE) {
    const [padre, madre] = getGenitoriDecedutiRe(re);
    return id === ID_PADRE_DECEDUTO_RE ? padre : madre;
  }
  if (id === ID_ZIO_PATERNO_DECEDUTO_RE) return getZioZiaDecedutoCuginoRe(re, "paterno");
  if (id === ID_ZIA_MATERNA_DECEDUTA_RE) return getZioZiaDecedutoCuginoRe(re, "materno");
  return null;
}

/** Mini-abitante solo per avatar / etichette UI (non va in `abitanti`). */
export function abitanteDaGenitoreDeceduto(g: GenitoreDecedutoRe): Abitante {
  return {
    id: g.id,
    nome: g.nome,
    emoji: "💀",
    eta: g.eta,
    lavoro: "Deceduto",
    competenza: 0,
    produttività: 0,
    stanchezza: 0,
    personalità: "—",
    amici: [],
    rivali: [],
    fazioni: [],
    peso: 0,
    salute: 0,
    reddito: 0,
    spese: 0,
    lealtà: 0,
    paura: 0,
    felicità: 0,
    religione: "Ateo",
    sesso: g.sesso,
    razza: "Umano",
    aspetto: g.aspetto
  };
}

export function èRe(abitante: Pick<Abitante, "id">): boolean {
  return abitante.id === ID_GIOCATORE;
}

export function latoCuginoDaGenitoriIds(genitoriIds: number[] | undefined): LatoCuginoRe | null {
  if (!genitoriIds?.length) return null;
  if (genitoriIds.includes(ID_ZIO_PATERNO_DECEDUTO_RE)) return "paterno";
  if (genitoriIds.includes(ID_ZIA_MATERNA_DECEDUTA_RE)) return "materno";
  return null;
}
