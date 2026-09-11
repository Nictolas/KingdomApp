/**
 * Orologio di gioco globale: a velocità ×1, 1 secondo reale = 1 minuto in-game.
 * Condiviso tra mappa, Bar e altre schermate che devono usare lo stesso tempo.
 * Velocità ×5 / ×10 moltiplicano i minuti di gioco per secondo reale.
 */

/** Minuti di gioco aggiunti per ogni secondo reale a velocità ×1. */
export const MINUTI_GIOCO_PER_SECONDO_REALE = 1;

export type OrologioVelocita = 1 | 5 | 10;

/** Pulsanti velocità nell’UI (mutualmente esclusivi con la pausa). */
export const OROLOGIO_VELOCITA_OPZIONI = [1, 5, 10] as const satisfies readonly OrologioVelocita[];

const VELOCITA_VALIDE = new Set<number>(OROLOGIO_VELOCITA_OPZIONI);

let orologioGiocoMinutiDaMezzanotte = 6 * 60;
let orologioGiocoLastRealMs: number | null = null;
let orologioGiocoInPausa = false;
// Parte bloccato: la creazione del Re non deve far avanzare il mondo.
let orologioGiocoBloccatoDallaFase = true;
/** Pausa forzata mentre è attiva la modalità Costruisci sulla mappa. */
let orologioGiocoBloccatoDaCostruzione = false;
/** Giorno di gioco (1 = primo giorno); avanza a ogni mezzanotte dell'orologio. */
let orologioGiocoGiorno = 1;
let orologioGiocoVelocita: OrologioVelocita = 1;

const pausaListeners = new Set<() => void>();
const giornoListeners = new Set<() => void>();
const oraListeners = new Set<(orePassate: number) => void>();
const velocitaListeners = new Set<() => void>();

function notifyGiornoListeners(): void {
  giornoListeners.forEach((l) => l());
}

function notifyOraListeners(orePassate: number): void {
  if (orePassate <= 0) return;
  oraListeners.forEach((l) => l(orePassate));
}

export function subscribeGiornoGioco(listener: () => void): () => void {
  giornoListeners.add(listener);
  return () => giornoListeners.delete(listener);
}

/** Notifica quante ore di gioco sono trascorse (anche >1 se il catch-up è rapido). */
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
  return orologioGiocoInPausa || orologioGiocoBloccatoDallaFase || orologioGiocoBloccatoDaCostruzione;
}

function notifyVelocitaListeners(): void {
  velocitaListeners.forEach((l) => l());
}

export function subscribeOrologioGiocoVelocita(listener: () => void): () => void {
  velocitaListeners.add(listener);
  return () => velocitaListeners.delete(listener);
}

export function getOrologioGiocoVelocitaSnapshot(): OrologioVelocita {
  return orologioGiocoVelocita;
}

/**
 * Scala del tempo di simulazione per movimenti/animazioni personaggi:
 * 0 in pausa, altrimenti ×1 / ×5 / ×10.
 */
export function getOrologioSimTimeScaleSnapshot(): number {
  if (getOrologioGiocoInPausaSnapshot()) return 0;
  return orologioGiocoVelocita;
}

/** Durata reale (ms) di un’azione calibrata a ×1, tenendo conto della velocità corrente. */
export function scalaDurataRealeMs(
  durataAVelocita1Ms: number,
  velocita: OrologioVelocita = orologioGiocoVelocita
): number {
  return Math.max(16, durataAVelocita1Ms / velocita);
}

/**
 * Imposta ×1 / ×5 / ×10 e riprende il tempo se era in pausa
 * (pausa e velocità non possono essere attive insieme).
 */
export function setOrologioGiocoVelocita(velocita: OrologioVelocita): void {
  if (!VELOCITA_VALIDE.has(velocita)) return;
  const stessaVelocita = orologioGiocoVelocita === velocita;
  const eraInPausa = orologioGiocoInPausa;
  if (stessaVelocita && !eraInPausa) return;

  // Applica eventuali minuti già maturati alla velocità precedente.
  syncOrologioGiocoDaWallClock();
  if (!stessaVelocita) {
    orologioGiocoVelocita = velocita;
  }
  orologioGiocoLastRealMs = Date.now();
  if (eraInPausa) {
    orologioGiocoInPausa = false;
    notifyPausaListeners();
  }
  if (!stessaVelocita) {
    notifyVelocitaListeners();
  }
}

export function setOrologioGiocoBloccatoDallaFase(bloccato: boolean): void {
  if (orologioGiocoBloccatoDallaFase === bloccato) return;
  orologioGiocoBloccatoDallaFase = bloccato;
  // Il tempo reale trascorso durante il blocco non deve essere recuperato alla ripresa.
  orologioGiocoLastRealMs = Date.now();
  notifyPausaListeners();
}

/** Blocca il tempo mentre il giocatore è in modalità Costruisci (menu o piazzamento). */
export function setOrologioGiocoBloccatoDaCostruzione(bloccato: boolean): void {
  if (orologioGiocoBloccatoDaCostruzione === bloccato) return;
  orologioGiocoBloccatoDaCostruzione = bloccato;
  orologioGiocoLastRealMs = Date.now();
  notifyPausaListeners();
}

export function getOrologioGiocoBloccatoDaCostruzioneSnapshot(): boolean {
  return orologioGiocoBloccatoDaCostruzione;
}

export function restoreOrologioGioco(input: {
  giorno: number;
  minutiDaMezzanotte: number;
  pausaManuale: boolean;
}): void {
  orologioGiocoGiorno = Math.max(1, Math.trunc(input.giorno));
  orologioGiocoMinutiDaMezzanotte = ((Math.trunc(input.minutiDaMezzanotte) % 1440) + 1440) % 1440;
  orologioGiocoInPausa = input.pausaManuale;
  orologioGiocoLastRealMs = Date.now();
  notifyGiornoListeners();
  notifyPausaListeners();
}

export function getOrologioPersistableSnapshot() {
  return {
    giorno: orologioGiocoGiorno,
    minutiDaMezzanotte: orologioGiocoMinutiDaMezzanotte,
    pausaManuale: orologioGiocoInPausa
  };
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

/**
 * Millisecondi reali per un minuto di gioco alla velocità corrente.
 * ×1 → 1000 ms, ×5 → 200 ms, ×10 → 100 ms.
 */
export function msRealiPerMinutoGioco(velocita: OrologioVelocita = orologioGiocoVelocita): number {
  return 1000 / (MINUTI_GIOCO_PER_SECONDO_REALE * velocita);
}

/** Aggiorna il tempo in base al clock reale e restituisce i minuti da mezzanotte [0, 1440). */
export function syncOrologioGiocoDaWallClock(): number {
  if (orologioGiocoLastRealMs == null) {
    orologioGiocoLastRealMs = Date.now();
    return orologioGiocoMinutiDaMezzanotte;
  }
  if (getOrologioGiocoInPausaSnapshot()) {
    orologioGiocoLastRealMs = Date.now();
    return orologioGiocoMinutiDaMezzanotte;
  }
  const now = Date.now();
  const elapsedMs = now - orologioGiocoLastRealMs;
  const msPerMin = msRealiPerMinutoGioco();
  const catchUp = Math.floor(elapsedMs / msPerMin);
  if (catchUp <= 0) {
    return orologioGiocoMinutiDaMezzanotte;
  }
  const minutiPrima = orologioGiocoMinutiDaMezzanotte;
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
    notifyOraListeners(orePassate);
  }
  // Conserva il residuo di ms non ancora convertito in un minuto di gioco.
  orologioGiocoLastRealMs += catchUp * msPerMin;
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
