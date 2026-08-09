import type { Abitante, Edificio, Risorsa } from "../types";
import { getProduttivitaEffettiva } from "./bisogni";

export const NOME_UFFICIO_EDILE = "Ufficio Edile";
export const NOME_RISORSA_MATERIALE_EDILE = "Materiale Edile";
export const PROGRESSO_COSTRUZIONE_COMPLETO = 100;

/** Punti costruzione base per ogni edile assegnato allo Skip Mese (prima della produttività). */
const PUNTI_BASE_PER_EDILE = 20;

/**
 * Edifici piazzati già operativi (niente cantiere):
 * - Ufficio Edile: serve subito per assumere gli edili
 * - Capanna: costo zero / alloggi precoci
 */
const NOMI_COSTRUZIONE_ISTANTANEA = new Set<string>([NOME_UFFICIO_EDILE, "Capanna"]);

export function edificioParteInCostruzione(nome: string): boolean {
  return !NOMI_COSTRUZIONE_ISTANTANEA.has(nome);
}

/** Costo in Materiale Edile al piazzamento (Capanna = 0). */
export function costoMaterialeEdilePerFootprint(nome: string, w: number, h: number): number {
  if (nome === "Capanna") return 0;
  return Math.max(5, Math.floor(w) * Math.floor(h) * 8);
}

export function quantitaMaterialeEdile(risorse: Risorsa[]): number {
  return risorse.find((r) => r.nome === NOME_RISORSA_MATERIALE_EDILE)?.quantità ?? 0;
}

export function haMaterialeEdileSufficiente(risorse: Risorsa[], costo: number): boolean {
  if (costo <= 0) return true;
  return quantitaMaterialeEdile(risorse) >= costo;
}

export function consumaMaterialeEdile(risorse: Risorsa[], costo: number): Risorsa[] {
  if (costo <= 0) return risorse;
  return risorse.map((r) =>
    r.nome === NOME_RISORSA_MATERIALE_EDILE
      ? { ...r, quantità: Math.max(0, r.quantità - costo) }
      : r
  );
}

/** Conta gli edili assegnati a Uffici Edili operativi. */
export function contaEdiliAssegnati(edifici: Edificio[]): number {
  let n = 0;
  for (const e of edifici) {
    if (e.nome !== NOME_UFFICIO_EDILE || e.stato !== "Operativo") continue;
    n += (e.abitantiAssegnati ?? []).length;
  }
  return n;
}

function puntiLavoroEdili(edifici: Edificio[], abitanti: Abitante[]): number {
  let punti = 0;
  for (const e of edifici) {
    if (e.nome !== NOME_UFFICIO_EDILE || e.stato !== "Operativo") continue;
    for (const id of e.abitantiAssegnati ?? []) {
      const a = abitanti.find((x) => x.id === id);
      const produttivita = a ? getProduttivitaEffettiva(a) : 50;
      // produttività tipica ~50 → moltiplicatore 1; min 0.4
      const mult = Math.max(0.4, produttivita / 50);
      punti += PUNTI_BASE_PER_EDILE * mult;
    }
  }
  return Math.floor(punti);
}

export type AvanzaCostruzioniResult = {
  edifici: Edificio[];
  completati: { id: number; nome: string }[];
};

/**
 * Gli edili dell'Ufficio Edile avanzano i cantieri allo Skip Mese.
 * I punti totali si ripartiscono in modo uniforme tra gli edifici «In costruzione».
 */
export function avanzaCostruzioniEdifici(
  edifici: Edificio[],
  abitanti: Abitante[]
): AvanzaCostruzioniResult {
  const cantieri = edifici.filter((e) => e.stato === "In costruzione");
  if (cantieri.length === 0) return { edifici, completati: [] };

  const puntiTotali = puntiLavoroEdili(edifici, abitanti);
  if (puntiTotali <= 0) return { edifici, completati: [] };

  const puntiPerCantiere = Math.max(1, Math.floor(puntiTotali / cantieri.length));
  const completati: { id: number; nome: string }[] = [];
  const byId = new Map(cantieri.map((c) => [c.id, c]));

  const next = edifici.map((e) => {
    if (e.stato !== "In costruzione" || !byId.has(e.id)) return e;
    const progresso = Math.min(
      PROGRESSO_COSTRUZIONE_COMPLETO,
      (e.progressoCostruzione ?? 0) + puntiPerCantiere
    );
    if (progresso >= PROGRESSO_COSTRUZIONE_COMPLETO) {
      completati.push({ id: e.id, nome: e.nome });
      return {
        ...e,
        stato: "Operativo" as const,
        progressoCostruzione: undefined
      };
    }
    return { ...e, progressoCostruzione: progresso };
  });

  return { edifici: next, completati };
}

/** Edifici ancora in cantiere (per UI Ufficio Edile). */
export function elencoCantieri(edifici: Edificio[]): Edificio[] {
  return edifici
    .filter((e) => e.stato === "In costruzione")
    .sort((a, b) => (a.progressoCostruzione ?? 0) - (b.progressoCostruzione ?? 0) || a.id - b.id);
}
