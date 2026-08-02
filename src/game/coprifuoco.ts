import type { Abitante, Edificio } from "../types";

/** Nome edificio Centrale di polizia (occupazione Sicurezza). */
export const NOME_CENTRALE_POLIZIA = "Centrale";

/** Default: 22:00 → 06:00. */
export const COPRIFUOCO_INIZIO_DEFAULT_MINUTI = 22 * 60;
export const COPRIFUOCO_FINE_DEFAULT_MINUTI = 6 * 60;

export type ConfigCoprifuoco = {
  attivo: boolean;
  /** Minuti da mezzanotte: inizio fascia (incluso). */
  inizioMinuti: number;
  /** Minuti da mezzanotte: fine fascia (escluso). Può essere < inizio se attraversa la mezzanotte. */
  fineMinuti: number;
};

export function clampMinutiGiorno(minuti: number): number {
  const m = Math.floor(minuti);
  if (!Number.isFinite(m)) return 0;
  const day = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
  return day;
}

export function formatOraDaMinuti(minuti: number): string {
  const m = clampMinutiGiorno(minuti);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** True se `minutiDaMezzanotte` cade nella fascia [inizio, fine) (anche overnight). */
export function minutiInFasciaCoprifuoco(
  minutiDaMezzanotte: number,
  inizioMinuti: number,
  fineMinuti: number
): boolean {
  const cur = clampMinutiGiorno(minutiDaMezzanotte);
  const start = clampMinutiGiorno(inizioMinuti);
  const end = clampMinutiGiorno(fineMinuti);
  if (start === end) return true; // fascia piena giornata
  if (start < end) return cur >= start && cur < end;
  // overnight: es. 22:00 → 06:00
  return cur >= start || cur < end;
}

/** Assegnato alla Centrale di polizia → esente dal coprifuoco. */
export function abitanteLavoraAllaCentrale(abitanteId: number, edifici: Edificio[]): boolean {
  return edifici.some(
    (e) => e.nome === NOME_CENTRALE_POLIZIA && (e.abitantiAssegnati ?? []).includes(abitanteId)
  );
}

/**
 * Soggetto al divieto di stare «In giro» durante il coprifuoco.
 * Esenti: chi lavora alla Centrale (occupazione Sicurezza).
 */
export function abitanteSoggettoACoprifuoco(
  abitante: Abitante,
  edifici: Edificio[],
  cfg: ConfigCoprifuoco,
  minutiDaMezzanotte: number
): boolean {
  if (!cfg.attivo) return false;
  if (!minutiInFasciaCoprifuoco(minutiDaMezzanotte, cfg.inizioMinuti, cfg.fineMinuti)) return false;
  if (abitanteLavoraAllaCentrale(abitante.id, edifici)) return false;
  return true;
}
