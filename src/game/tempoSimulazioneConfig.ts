/** La scala temporale e' condivisa dall'orologio e dal calendario.
 * A velocita' 1x: 1 giorno = 4 minuti reali; un anno (60 giorni) = 4 ore.
 */
export const MINUTI_GIOCO_PER_SECONDO_REALE = 6;
export const GIORNI_PER_MESE_GIOCO = 5;
export const MESI_PER_ANNO_GIOCO = 12;
export const GIORNI_PER_ANNO_GIOCO = GIORNI_PER_MESE_GIOCO * MESI_PER_ANNO_GIOCO;
export const SECONDI_REALI_PER_GIORNO_1X = 1440 / MINUTI_GIOCO_PER_SECONDO_REALE;
export const ORE_REALI_PER_ANNO_1X =
  SECONDI_REALI_PER_GIORNO_1X * GIORNI_PER_ANNO_GIOCO / 3600;

/** Le entrate e consumi giornalieri monetari vanno tarati sul nuovo mese da 5 giorni.
 * Non applicare questo fattore automaticamente alle probabilita' di malattia o morte.
 */
export const GIORNI_PER_MESE_LEGACY = 30;
export const FATTORE_ECONOMIA_GIORNALIERA = GIORNI_PER_MESE_LEGACY / GIORNI_PER_MESE_GIOCO;
