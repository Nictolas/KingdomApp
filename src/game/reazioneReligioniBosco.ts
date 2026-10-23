import type { Abitante, Edificio } from "../types";
import type { ReligioneCustom } from "./fedeleCulto";
import {
  modificatoreSoddisfazioneBosco,
  normalizzaStatoEcosistemaBosco
} from "./ecosistemaBosco";

export const ID_MALUS_RELIGIOSO_BOSCO = "religione-rispetto-bosco";

/**
 * Ricalcola un SOLO modificatore situazionale dalle scorte presenti.
 * Non somma un nuovo malus ogni giorno; in caso di recupero il malus
 * scende o scompare. Le religioni canoniche senza dottrina dichiarata
 * e quelle personalizzate prive di dottrina restano neutrali.
 */
export function aggiornaSoddisfazioneReligioniNaturaliste(
  abitanti: Abitante[],
  edifici: Edificio[],
  religioniCustom: readonly ReligioneCustom[]
): Abitante[] {
  const bosco = edifici.find(e => e.nome === "Bosco" && e.stato === "Operativo");
  const scorte = bosco
    ? normalizzaStatoEcosistemaBosco(bosco.ecosistemaBosco, 0).riserve
    : null;
  const dottrine = new Map(religioniCustom.map(r => [r.nome, r.dottrinaNaturalista]));
  let changed = false;
  const result = abitanti.map(a => {
    const dottrina = dottrine.get(a.religione);
    const malus = scorte && dottrina
      ? modificatoreSoddisfazioneBosco(dottrina, scorte)
      : 0;
    const mod = a.modificatoriSoddisfazione ?? [];
    const precedente = mod.find(m => m.id === ID_MALUS_RELIGIOSO_BOSCO);
    if (malus === 0 && !precedente) return a;
    if (precedente?.delta === malus && malus !== 0 &&
      mod.filter(m => m.id === ID_MALUS_RELIGIOSO_BOSCO).length === 1) return a;
    changed = true;
    const altri = mod.filter(m => m.id !== ID_MALUS_RELIGIOSO_BOSCO);
    if (malus === 0) {
      return { ...a, modificatoriSoddisfazione: altri.length ? altri : undefined };
    }
    return {
      ...a,
      modificatoriSoddisfazione: [...altri, {
        id: ID_MALUS_RELIGIOSO_BOSCO,
        delta: malus,
        motivo: "Danneggiamento del Bosco contrario alla fede",
        durata: "permanente" as const
      }]
    };
  });
  return changed ? result : abitanti;
}
