/**
 * Orologio di gioco globale: 1 secondo reale = 6 minuti in-game (4 ore reali per anno).
 * Condiviso tra mappa, Bar e altre schermate che devono usare lo stesso tempo.
 */

/** Minuti di gioco aggiunti per ogni secondo trascorso nel mondo reale. */
import { MINUTI_GIOCO_PER_SECONDO_REALE } from "./tempoSimulazioneConfig";
export { MINUTI_GIOCO_PER_SECONDO_REALE } from "./tempoSimulazioneConfig";

export const OROLOGIO_GIOCO_VELOCITA = [1, 2, 4] as const;
export type OrologioGiocoVelocita = (typeof OROLOGIO_GIOCO_VELOCITA)[number];

let orologioGiocoMinutiDaMezzanotte = 6 * 60;
let orologioGiocoLastRealMs: number | null = null;
let orologioGiocoInPausa = false;
let orologioGiocoSospesoDallApp = false;
let orologioGiocoVelocita: OrologioGiocoVelocita = 1;
// Parte bloccato: la creazione del Re non deve far avanzare il mondo.
let orologioGiocoBloccatoDallaFase = true;
/** Giorno di gioco (1 = primo giorno); avanza a ogni mezzanotte dell'orologio. */
let orologioGiocoGiorno = 1;

const pausaListeners = new Set<() => void>();
const velocitaListeners = new Set<() => void>();
const giornoListeners = new Set<() => void>();
const oraListeners = new Set<(orePassate: number) => void>();

function notifyGiornoListeners(): void {
  giornoListeners.forEach((l) => l());
}

export function subscribeGiornoGioco(listener: () => void): () => void {
  giornoListeners.add(listener);
  return () => giornoListeners.delete(listener);
}

export function subscribeOraGioco(listener: (orePassate: number) => void): () => void {
  oraListeners.add(listener);
  return () => oraListeners.delete(listener);
}

export function getGiornoGiocoSnapshot(): number {
  return orologioGiocoGiorno;
}

function notifyPausaListeners(): void {
  pausaListeners.forEach((l) => l());
}

export function subscribeOrologioGiocoInPausa(listener: () => void): () => void {
  pausaListeners.add(listener);
  return () => pausaListeners.delete(listener);
}

export function getOrologioGiocoInPausaSnapshot(): boolean {
  return orologioGiocoInPausa || orologioGiocoBloccatoDallaFase || orologioGiocoSospesoDallApp;
}

export function subscribeOrologioGiocoVelocita(listener: () => void): () => void {
  velocitaListeners.add(listener);
  return () => velocitaListeners.delete(listener);
}

export function getOrologioGiocoVelocitaSnapshot(): OrologioGiocoVelocita {
  return orologioGiocoVelocita;
}

/** Scala del tempo di simulazione per movimenti/animazioni: 0 in pausa, altrimenti la velocità corrente. */
export function getOrologioSimTimeScaleSnapshot(): number {
  if (getOrologioGiocoInPausaSnapshot()) return 0;
  return orologioGiocoVelocita;
}

/** Durata reale di un'azione calibrata a velocità ×1. */
export function scalaDurataRealeMs(
  durataAVelocita1Ms: number,
  velocita: OrologioGiocoVelocita = orologioGiocoVelocita
): number {
  return Math.max(16, durataAVelocita1Ms / velocita);
}

function notifyVelocitaListeners(): void {
  velocitaListeners.forEach((l) => l());
}

export function setOrologioGiocoVelocita(velocita: OrologioGiocoVelocita): void {
  if (!OROLOGIO_GIOCO_VELOCITA.includes(velocita)) return;

  // Se si seleziona una velocità mentre il gioco è in pausa, quella selezione
  // rappresenta anche la ripresa: Pausa e 1×/2×/4× sono modalità esclusive.
  syncOrologioGiocoDaWallClock();
  const velocitaCambiata = orologioGiocoVelocita !== velocita;
  orologioGiocoVelocita = velocita;
  orologioGiocoLastRealMs = Date.now();
  if (velocitaCambiata) notifyVelocitaListeners();
  if (orologioGiocoInPausa) setOrologioGiocoInPausa(false);
}

export function setOrologioGiocoBloccatoDallaFase(bloccato: boolean): void {
  if (orologioGiocoBloccatoDallaFase === bloccato) return;
  orologioGiocoBloccatoDallaFase = bloccato;
  // Il tempo reale trascorso durante il blocco non deve essere recuperato alla ripresa.
  orologioGiocoLastRealMs = Date.now();
  notifyPausaListeners();
}

export function restoreOrologioGioco(input: { giorno: number; minutiDaMezzanotte: number; pausaManuale: boolean }): void {
  orologioGiocoGiorno = Math.max(1, Math.trunc(input.giorno));
  orologioGiocoMinutiDaMezzanotte = ((Math.trunc(input.minutiDaMezzanotte) % 1440) + 1440) % 1440;
  orologioGiocoInPausa = input.pausaManuale;
  orologioGiocoVelocita = 1;
  orologioGiocoSospesoDallApp = false;
  orologioGiocoLastRealMs = Date.now();
  notifyGiornoListeners();
  notifyPausaListeners();
  notifyVelocitaListeners();
}

export function getOrologioPersistableSnapshot() {
  return {
    giorno: orologioGiocoGiorno,
    minutiDaMezzanotte: orologioGiocoMinutiDaMezzanotte,
    pausaManuale: orologioGiocoInPausa
  };
}

/** Il tempo non trascorre in background: nessun recupero al ritorno.
 * Non salvare questa sospensione come pausa manuale dell'utente.
 */
export function setOrologioGiocoSospesoDallApp(sospeso: boolean): void {
  if (orologioGiocoSospesoDallApp === sospeso) return;
  orologioGiocoSospesoDallApp = sospeso;
  orologioGiocoLastRealMs = Date.now();
  notifyPausaListeners();
}

export function setOrologioGiocoInPausa(pausa: boolean): void {
  if (orologioGiocoInPausa === pausa) return;
  orologioGiocoInPausa = pausa;
  if (orologioGiocoLastRealMs != null) {
    orologioGiocoLastRealMs = Date.now();
  }
  notifyPausaListeners();
}

export function toggleOrologioGiocoPausa(): void {
  setOrologioGiocoInPausa(!orologioGiocoInPausa);
}

/** Aggiorna il tempo in base al clock reale e restituisce i minuti da mezzanotte [0, 1440). */
/** Carry sub-second jitter between timer polls, with capped catch-up after a stall. */
export function calcolaProgressoOrologio(lastRealMs: number, nowRealMs: number): {secondi: number; nextReferenceMs: number} {
  const deltaMs = Math.max(0, nowRealMs - lastRealMs);
  if (deltaMs > 5000) return { secondi: 5, nextReferenceMs: nowRealMs };
  const secondi = Math.floor(deltaMs / 1000);
  return { secondi, nextReferenceMs: lastRealMs + secondi * 1000 };
}

export function syncOrologioGiocoDaWallClock(): number {
  if (orologioGiocoLastRealMs == null) {
    orologioGiocoLastRealMs = Date.now();
    return orologioGiocoMinutiDaMezzanotte;
  }
  if (getOrologioGiocoInPausaSnapshot()) {
    orologioGiocoLastRealMs = Date.now();
    return orologioGiocoMinutiDaMezzanotte;
  }
  const minutiPrima = orologioGiocoMinutiDaMezzanotte;
  // Se Safari ha sospeso i timer senza notificare visibilitychange, non recuperare ore offline.
  const { secondi: elapsedSeconds, nextReferenceMs } = calcolaProgressoOrologio(orologioGiocoLastRealMs, Date.now());
  const catchUp =
    elapsedSeconds * MINUTI_GIOCO_PER_SECONDO_REALE * orologioGiocoVelocita;
  const totalMinPrima = (orologioGiocoGiorno - 1) * 1440 + minutiPrima;
  const minutiTotali = minutiPrima + catchUp;
  orologioGiocoMinutiDaMezzanotte = minutiTotali % 1440;
  const giorniPassati = Math.floor(minutiTotali / 1440);
  if (giorniPassati > 0) {
    orologioGiocoGiorno += giorniPassati;
    notifyGiornoListeners();
  }
  const orePassate =
    Math.floor((totalMinPrima + catchUp) / 60) - Math.floor(totalMinPrima / 60);
  if (orePassate > 0) {
    oraListeners.forEach((listener) => listener(orePassate));
  }
  orologioGiocoLastRealMs = nextReferenceMs;
  return orologioGiocoMinutiDaMezzanotte;
}

export function getOrologioMinutiSnapshot(): number {
  return orologioGiocoMinutiDaMezzanotte;
}

export function formatOrologioGioco(minutiDaMezzanotte: number): string {
  const m = ((minutiDaMezzanotte % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
