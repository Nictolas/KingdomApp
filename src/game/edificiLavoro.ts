import type { Abitante, Edificio } from "../types";
import { EDIFICIO_COMPETENZA_RICHIESTA } from "../data/edificiCompetenze";

/** Mappa edificioId → nome lavoro. Usata per sincronizzare lavoro abitante e per auto-assign Skip Mese. */
export const EDIFICIO_TO_LAVORO: Record<number, string> = {
  2: "Agricoltore",     // Serra
  3: "Tecnico",         // Raffineria Mineraria
  5: "Ricercatore",     // Laboratorio di Ricerca
  6: "Operatore",       // Centrale Energetica
  7: "Medico",          // Ospedale Coloniale
  11: "Insegnante",     // Scuola
  12: "Giudice",        // Tribunale
  13: "Operatore",      // Impianto di Riciclo
  15: "Operatore",      // Dissalatore
  16: "Sicurezza",      // Caserma
  17: "Barista",        // Bar
  18: "Polizia"         // Centrale (polizia)
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

/**
 * Assegna automaticamente i Disoccupati (non Robot) agli edifici con posti liberi,
 * se la competenza dell'abitante è >= competenzaMinima dell'edificio.
 * Ordine edifici per id; per ogni edificio si riempiono i posti con i disoccupati migliori (competenza più alta).
 * Restituisce i nuovi edifici (con abitantiAssegnati aggiornati).
 */
export function autoAssegnaDisoccupati(abitanti: Abitante[], edifici: Edificio[]): Edificio[] {
  const reqIds = Object.keys(EDIFICIO_COMPETENZA_RICHIESTA).map(Number).sort((a, b) => a - b);
  const disoccupati = abitanti
    .filter((a) => a.lavoro === "Disoccupato" && a.razza !== "Robot")
    .sort((a, b) => b.competenza - a.competenza);
  const assigned = new Set<number>();
  const edificiOut = edifici.map((e) => ({ ...e, abitantiAssegnati: [...(e.abitantiAssegnati ?? [])] }));

  for (const edificioId of reqIds) {
    const req = EDIFICIO_COMPETENZA_RICHIESTA[edificioId];
    if (!req) continue;
    const edificio = edificiOut.find((x) => x.id === edificioId);
    if (!edificio) continue;
    const cap = edificio.capacità ?? 0;
    const current = edificio.abitantiAssegnati!.length;
    const slotLiberi = cap - current;
    if (slotLiberi <= 0) continue;

    let aggiunti = 0;
    for (const a of disoccupati) {
      if (aggiunti >= slotLiberi) break;
      if (assigned.has(a.id)) continue;
      if (a.competenza < req.competenzaMinima) continue;
      edificio.abitantiAssegnati!.push(a.id);
      assigned.add(a.id);
      aggiunti++;
    }
  }

  return edificiOut;
}
