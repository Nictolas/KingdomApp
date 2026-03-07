import type { Abitante, Edificio } from "../types";

/** Mappa edificioId → nome lavoro (Serra=Agricoltore, Dissalatore=Operatore, Caserma=Sicurezza, Centrale=Polizia). */
export const EDIFICIO_TO_LAVORO: Record<number, string> = {
  2: "Agricoltore",   // Serra
  15: "Operatore",    // Dissalatore
  16: "Sicurezza",    // Caserma
  18: "Polizia"       // Centrale
};

const LAVORI_DA_EDIFICIO = new Set(Object.values(EDIFICIO_TO_LAVORO));

/**
 * Restituisce gli abitanti con "lavoro" sincronizzato alle assegnazioni agli edifici.
 * Pensionati non toccati; chi è in un edificio-lavoro prende quel lavoro, chi era in edificio-lavoro ma non più assegnato diventa Disoccupato.
 */
export function sincronizzaLavoroDaEdifici(
  abitanti: Abitante[],
  edifici: Edificio[]
): Abitante[] {
  const idToLavoroFromEdifici = new Map<number, string>();
  edifici.forEach((edificio) => {
    const job = EDIFICIO_TO_LAVORO[edificio.id];
    if (!job) return;
    (edificio.abitantiAssegnati ?? []).forEach((id) => idToLavoroFromEdifici.set(id, job));
  });

  let changed = false;
  const next = abitanti.map((a) => {
    if (a.lavoro === "Pensionato") return a;
    const jobFromEdificio = idToLavoroFromEdifici.get(a.id);
    if (jobFromEdificio) {
      if (a.lavoro === jobFromEdificio) return a;
      changed = true;
      return { ...a, lavoro: jobFromEdificio };
    }
    if (LAVORI_DA_EDIFICIO.has(a.lavoro)) {
      changed = true;
      return { ...a, lavoro: "Disoccupato" };
    }
    return a;
  });
  return changed ? next : abitanti;
}
