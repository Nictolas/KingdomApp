/**
 * Ciclo giorno/notte (tempo di gioco).
 * Alba 5:30–8:00 · Giorno 8:00–17:00 · Tramonto 17:00–20:00 · Notte 20:00–5:30
 */

const CIELO_ALBA_INIZIO = 5 * 60 + 30;
const CIELO_ALBA_FINE = 8 * 60;
const CIELO_TRAMONTO_INIZIO = 17 * 60;
const CIELO_TRAMONTO_FINE = 20 * 60;

function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export function computeStatoCielo(minutiDaMezzanotte: number): { buio: number; caloreTramonto: number } {
  const m = ((minutiDaMezzanotte % 1440) + 1440) % 1440;
  let buio = 0;
  let caloreTramonto = 0;

  if (m >= CIELO_TRAMONTO_FINE || m < CIELO_ALBA_INIZIO) {
    buio = 1;
  } else if (m >= CIELO_ALBA_INIZIO && m < CIELO_ALBA_FINE) {
    const t = (m - CIELO_ALBA_INIZIO) / (CIELO_ALBA_FINE - CIELO_ALBA_INIZIO);
    buio = 1 - smoothstep01(t);
  } else if (m >= CIELO_ALBA_FINE && m < CIELO_TRAMONTO_INIZIO) {
    buio = 0;
  } else if (m >= CIELO_TRAMONTO_INIZIO && m < CIELO_TRAMONTO_FINE) {
    const t = (m - CIELO_TRAMONTO_INIZIO) / (CIELO_TRAMONTO_FINE - CIELO_TRAMONTO_INIZIO);
    buio = smoothstep01(t);
    caloreTramonto = Math.sin(Math.PI * t);
  }

  return { buio, caloreTramonto };
}

/** Stessa soglia della mappa per “notte” (casa / non al bar). */
export const NOTTE_BUIO_SOGLIA_ROUTINE = 0.5;

export function èNotteRoutineMappaDaBuio(buioCielo: number): boolean {
  return buioCielo > NOTTE_BUIO_SOGLIA_ROUTINE;
}
