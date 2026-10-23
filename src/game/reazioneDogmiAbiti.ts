import type { Abitante } from "../types";
import type { ReligioneCustom } from "./fedeleCulto";
import { abitoPrescrittoDaDogma } from "./dogmiReligiosi";

export const ID_DOGMA_ABITO_FEDELI = "dogma-abito-fedeli";
export const ID_DOGMA_ABITO_SACERDOTI = "dogma-abito-sacerdoti";

const RUOLI_SACERDOTALI = new Set(["Sacerdote", "Capo Religioso", "Druido"]);

/** Reazione individuale alle norme di vestiario. Non cambia con la sola
 * appartenenza religiosa: il residente si considera in regola se indossa
 * davvero l'abito richiesto nel suo aspetto.
 *
 * Non applica abiti virtuali, non trasforma l'inventario e non aggiunge
 * penalità a ogni tick. La nuova scelta del culto rimpiazza il vecchio
 * modificatore, e la conformità lo rimuove.
 */
export function aggiornaSoddisfazioneDogmiAbiti(
  abitanti: Abitante[],
  religioni: readonly ReligioneCustom[]
): Abitante[] {
  const perNome = new Map(religioni.map(r => [r.nome, r.dogmi ?? []] as const));
  let changed = false;
  const result = abitanti.map(a => {
    const dogmi = perNome.get(a.religione) ?? [];
    const fedele = abitoPrescrittoDaDogma(dogmi, "fedeli");
    const sacerdote = RUOLI_SACERDOTALI.has(a.lavoro)
      ? abitoPrescrittoDaDogma(dogmi, "sacerdoti") : null;
    const violations: { id: string; delta: number; motivo: string; durata: "permanente" }[] = [];
    if (fedele && a.aspetto?.vestiti !== fedele) {
      violations.push({
        id: ID_DOGMA_ABITO_FEDELI, delta: -2,
        motivo: "Non rispetta gli abiti richiesti dalla propria fede", durata: "permanente"
      });
    }
    if (sacerdote && a.aspetto?.vestiti !== sacerdote) {
      violations.push({
        id: ID_DOGMA_ABITO_SACERDOTI, delta: -3,
        motivo: "Non indossa i paramenti sacerdotali prescritti", durata: "permanente"
      });
    }
    const old = a.modificatoriSoddisfazione ?? [];
    const altri = old.filter(m =>
      m.id !== ID_DOGMA_ABITO_FEDELI && m.id !== ID_DOGMA_ABITO_SACERDOTI);
    const precedenti = old.filter(m =>
      m.id === ID_DOGMA_ABITO_FEDELI || m.id === ID_DOGMA_ABITO_SACERDOTI);
    if (violations.length === precedenti.length &&
      violations.every(n => precedenti.some(o =>
        o.id === n.id && o.delta === n.delta && o.motivo === n.motivo))) {
      return a;
    }
    changed = true;
    const mods = [...altri, ...violations];
    return {
      ...a,
      modificatoriSoddisfazione: mods.length > 0 ? mods : undefined
    };
  });
  return changed ? result : abitanti;
}
