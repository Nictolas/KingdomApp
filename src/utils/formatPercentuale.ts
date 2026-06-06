/** Etichetta legenda grafici a torta: conteggio + percentuale precisa (es. "15 (88,2%)"). */
export function formattaConteggioPercentuale(conteggio: number, totale: number): string {
  if (totale <= 0) return `${conteggio} (0,0%)`;
  const pct = (conteggio / totale) * 100;
  const pctStr = pct.toLocaleString("it-IT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
  return `${conteggio} (${pctStr}%)`;
}
