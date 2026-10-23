/**
 * Avventura: un cugino Nobile del Re + 2 Schiavi privati.
 */

import type { Abitante } from "../types";
import { alimentazioneCasuale } from "./alimentazione";
import { redditoMensileLavoroDefault } from "./economiaPrezzi";
import { abitanteConInventarioIniziale } from "./inventario";
import { COGNOMI_UMANI, NOMI_UMANI_CON_SESSO } from "./nomiUmani";
import { generaAspettoCasuale } from "./personaggioAspetto";
import {
  getZioZiaDecedutoCuginoRe,
  latoCuginoDaGenitoriIds,
  type LatoCuginoRe
} from "./reGenitoriDeceduti";
import { ID_GIOCATORE } from "./schiavituCommercio";
import { specializzazioneCasuale } from "./specializzazione";
import { inferTitoloStudioPerEta } from "./titoloStudio";

function cognomeDaNomeCompleto(nomeCompleto: string): string {
  const t = nomeCompleto.trim();
  const i = t.lastIndexOf(" ");
  if (i <= 0) return COGNOMI_UMANI[0]!;
  return t.slice(i + 1).trim() || COGNOMI_UMANI[0]!;
}

function pickNomeCompleto(sesso: "M" | "F", cognome: string): string {
  const pool = NOMI_UMANI_CON_SESSO.filter((n) => n.sesso === sesso);
  const list = pool.length > 0 ? pool : NOMI_UMANI_CON_SESSO;
  const nome = list[Math.floor(Math.random() * list.length)]!.nome;
  return `${nome} ${cognome}`;
}

const EMOJI_M = ["👨", "👨‍💼", "👨‍🌾"];
const EMOJI_F = ["👩", "👩‍💼", "👩‍🌾"];

/**
 * Aggiunge cugino Nobile + 2 Schiavi a fine generazione Avventura.
 * Il cugino è figlio dello zio paterno deceduto del Re.
 */
export function aggiungiCuginoNobileConSchiaviAvventura(abitanti: Abitante[]): Abitante[] {
  const re = abitanti.find((a) => a.id === ID_GIOCATORE);
  if (!re) return abitanti;

  const lato: LatoCuginoRe = "paterno";
  const genitoreDeceduto = getZioZiaDecedutoCuginoRe(re, lato);
  const cognome = cognomeDaNomeCompleto(genitoreDeceduto.nome);
  const nextId = Math.max(...abitanti.map((a) => a.id), 0) + 1;

  const sessoCugino: "M" | "F" = Math.random() < 0.5 ? "M" : "F";
  const etaCugino = 22 + Math.floor(Math.random() * 20);
  let cugino: Abitante = {
    id: nextId,
    nome: pickNomeCompleto(sessoCugino, cognome),
    emoji:
      sessoCugino === "M"
        ? EMOJI_M[Math.floor(Math.random() * EMOJI_M.length)]!
        : EMOJI_F[Math.floor(Math.random() * EMOJI_F.length)]!,
    eta: etaCugino,
    lavoro: "Disoccupato",
    competenza: 40 + Math.floor(Math.random() * 40),
    produttività: 45 + Math.floor(Math.random() * 40),
    stanchezza: Math.floor(Math.random() * 40),
    personalità: "Tiepido",
    alimentazione: alimentazioneCasuale(),
    amici: [],
    rivali: [],
    fazioni: ["Amministrazione"],
    peso: 50 + Math.floor(Math.random() * 30),
    salute: 55 + Math.floor(Math.random() * 40),
    crediti: 0,
    reddito: 0,
    spese: 0,
    timore: Math.floor(Math.random() * 25),
    religione: "Deista",
    razza: "Umano",
    sesso: sessoCugino,
    orientamento: "Etero",
    specializzazione: specializzazioneCasuale(),
    genitoriIds: [genitoreDeceduto.id],
    casta: "Nobile",
    ruoloSchiavitu: undefined,
    schiavistaId: undefined,
    aspetto: generaAspettoCasuale("Umano", Math.random, {
      eta: etaCugino,
      sesso: sessoCugino
    })
  };
  const titolo = inferTitoloStudioPerEta(cugino.eta, 18, cugino.razza);
  if (titolo) cugino.titoloStudio = titolo;
  cugino = abitanteConInventarioIniziale(cugino);

  const schiavi: Abitante[] = [];
  for (let i = 0; i < 2; i++) {
    const sessoS: "M" | "F" = Math.random() < 0.5 ? "M" : "F";
    const etaS = 20 + Math.floor(Math.random() * 35);
    const cognomeS = COGNOMI_UMANI[Math.floor(Math.random() * COGNOMI_UMANI.length)]!;
    let schiavo: Abitante = {
      id: nextId + 1 + i,
      nome: pickNomeCompleto(sessoS, cognomeS),
      emoji:
        sessoS === "M"
          ? EMOJI_M[Math.floor(Math.random() * EMOJI_M.length)]!
          : EMOJI_F[Math.floor(Math.random() * EMOJI_F.length)]!,
      eta: etaS,
      lavoro: "Disoccupato",
      competenza: 30 + Math.floor(Math.random() * 50),
      produttività: 40 + Math.floor(Math.random() * 40),
      stanchezza: Math.floor(Math.random() * 50),
      personalità: "Tiepido",
      alimentazione: alimentazioneCasuale(),
      amici: [],
      rivali: [],
      fazioni: ["Lavoratori", "Schiavi"],
      peso: 45 + Math.floor(Math.random() * 35),
      salute: 45 + Math.floor(Math.random() * 40),
      crediti: 0,
      reddito: redditoMensileLavoroDefault(),
      spese: 0,
      timore: 10 + Math.floor(Math.random() * 30),
      religione: "Ateo",
      razza: "Umano",
        sesso: sessoS,
      orientamento: "Etero",
      specializzazione: specializzazioneCasuale(),
      casta: "Schiavo",
      ruoloSchiavitu: "schiavo",
      schiavistaId: cugino.id,
      aspetto: generaAspettoCasuale("Umano", Math.random, { eta: etaS, sesso: sessoS })
    };
    const titoloS = inferTitoloStudioPerEta(schiavo.eta, 18, schiavo.razza);
    if (titoloS) schiavo.titoloStudio = titoloS;
    schiavo = abitanteConInventarioIniziale(schiavo);
    schiavi.push(schiavo);
  }

  return [...abitanti, cugino, ...schiavi];
}

/** Dopo la creazione del Re: riallinea cognome del cugino allo zio paterno. */
export function sincronizzaCuginoNobileConRe(abitanti: Abitante[]): Abitante[] {
  const re = abitanti.find((a) => a.id === ID_GIOCATORE);
  if (!re || !re.nome || re.nome === "—") return abitanti;

  const cugino = trovaCuginoNobileDelRe(abitanti);
  if (!cugino) return abitanti;

  const lato = latoCuginoDaGenitoriIds(cugino.genitoriIds);
  if (!lato) return abitanti;

  const genitore = getZioZiaDecedutoCuginoRe(re, lato);
  const cognome = cognomeDaNomeCompleto(genitore.nome);
  const nomeProprio = cugino.nome.trim().split(/\s+/)[0] || "Nobile";
  const nomeNuovo = `${nomeProprio} ${cognome}`;
  if (nomeNuovo === cugino.nome && cugino.genitoriIds?.[0] === genitore.id) return abitanti;

  return abitanti.map((a) =>
    a.id === cugino.id ? { ...a, nome: nomeNuovo, genitoriIds: [genitore.id] } : a
  );
}

/** Cugino Nobile del Re (genitore = zio/zia deceduti), se presente. */
export function trovaCuginoNobileDelRe(abitanti: readonly Abitante[]): Abitante | undefined {
  return abitanti.find((a) => {
    if (a.id === ID_GIOCATORE) return false;
    if (a.casta !== "Nobile") return false;
    return latoCuginoDaGenitoriIds(a.genitoriIds) != null;
  });
}
