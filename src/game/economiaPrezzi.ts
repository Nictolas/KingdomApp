/**
 * Tabella prezzi canonica (scala monete).
 * Unità: 1 moneta ≈ 1 giorno di stipendio base pubblico.
 * Unica cassa colonia = Tesoro (`moneteGiocatore`): stipendi, mercato, affitti, eventi.
 */

/** Giorni di lavoro simulati per mese (stipendi). */
export const GIORNI_MESE_ECONOMIA = 30;

/** Stipendio base pubblico: monete al giorno. */
export const STIPENDIO_BASE_MONETE_GIORNO = 1;

/** Stipendio base pubblico: monete al mese (display / default edificio). */
export const STIPENDIO_BASE_MONETE_MESE = STIPENDIO_BASE_MONETE_GIORNO * GIORNI_MESE_ECONOMIA;

/** Cassa iniziale delle imprese del regno. */
export const CASSA_IMPRESA_SEED = 10;

/** Tassa mensile sul fatturato delle imprese. */
export const TASSA_IMPRESA_PERCENTUALE = 10;

/** Costo monete per entrare al bar. */
export const COSTO_BAR_MONETE = 2;

/** Prezzo monete per 1 unità di cibo base al Negozio. */
export const PREZZO_CIBO_NEGOZIO = 3;

/** Prezzo di riferimento compravendita schiavi (monete). */
export const PREZZO_SCHIAVO_DEFAULT = 100;

/** Monete iniziali tipiche in inventario abitante (seed). */
export const MONETE_INVENTARIO_SEED_MIN = 20;
export const MONETE_INVENTARIO_SEED_MAX = 40;
export const MONETE_INVENTARIO_SEED_DEFAULT = 30;

/**
 * Tesoro iniziale (ex monete stipendi 500 + ex Crediti colonia 1250).
 */
export const MONETE_GIOCATORE_INIZIALI = 1750;

/** Assegno pensionati default (monete/mese). */
export const ASSEGNO_PENSIONATI_DEFAULT = 12;

/** Reddito di cittadinanza default (monete/mese); 0 = disattivato. */
export const REDDITO_CITTADINANZA_DEFAULT = 0;

/** Aliquota default Tassa sul Patrimonio (% monete in inventario / mese). */
export const TASSA_PATRIMONIO_PERCENTUALE_DEFAULT = 5;

/** Aliquota default Imposta sul Valore Aggiunto (% valore produzione / mese). */
export const IVA_PERCENTUALE_DEFAULT = 10;

/** Prezzo monete per 1 unità di output stimata (base imponibile IVA). */
export const PREZZO_UNITA_VALORE_AGGIUNTO = 1;

/**
 * Affitti mensili (monete) per nome residenza.
 * Allineati allo stipendio ~30/mese: dormitorio sostenibile, villa solo elite.
 */
export const AFFITTO_MENSILE_PER_RESIDENZA: Record<string, number> = {
  Baracca: 0,
  Capanna: 0,
  Dormitorio: 10,
  Modulo: 22,
  Villetta: 40,
  Attico: 80,
  Villa: 150
};

export function costoMensileResidenzaDefault(nome: string): number {
  return AFFITTO_MENSILE_PER_RESIDENZA[nome] ?? 0;
}

/** Seed monete inventario in [min, max]. */
export function moneteInventarioSeedCasuali(): number {
  const span = MONETE_INVENTARIO_SEED_MAX - MONETE_INVENTARIO_SEED_MIN;
  return MONETE_INVENTARIO_SEED_MIN + Math.floor(Math.random() * (span + 1));
}

/**
 * Converte crediti legacy residui nella scala monete (evita saldi 500–1500).
 */
export function moneteDaCreditiLegacy(creditiLegacy: number): number {
  const raw = Math.max(0, Math.floor(creditiLegacy));
  if (raw <= 0) return 0;
  return Math.min(
    MONETE_INVENTARIO_SEED_MAX,
    Math.max(MONETE_INVENTARIO_SEED_MIN, Math.round(raw / 40))
  );
}

/** Stipendio mensile display per un lavoro generico (non pubblico). */
export function redditoMensileLavoroDefault(): number {
  return STIPENDIO_BASE_MONETE_MESE;
}
